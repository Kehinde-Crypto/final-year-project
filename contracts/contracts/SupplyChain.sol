// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title SupplyChain
 * @dev Blockchain-based supply chain tracking system
 * @notice Tracks product movement from Manufacturer to Consumer
 */
contract SupplyChain {
    
    
    
    enum ActorRole { None, Manufacturer, Supplier, Distributor, Retailer, Consumer }
    enum ProductStatus { Created, InTransit, Delivered, Sold, Recalled }
    
  
    
    struct Actor {
        address id;
        string name;
        ActorRole role;
        string location;
        bool isActive;
        uint256 registeredAt;
    }
    
    struct Product {
        uint256 id;
        string name;
        string description;
        string category;
        address manufacturer;
        address currentOwner;
        ProductStatus status;
        uint256 createdAt;
        uint256 updatedAt;
    }
    
    struct TransferRecord {
        uint256 id;
        uint256 productId;
        address from;
        address to;
        string location;
        string notes;
        uint256 timestamp;
    }
    
    // ============ State Variables ============
    
    address public owner;
    uint256 public productCount;
    uint256 public transferCount;
    
    // Mappings
    mapping(address => Actor) public actors;
    mapping(uint256 => Product) public products;
    mapping(uint256 => TransferRecord) public transfers;
    mapping(uint256 => uint256[]) public productTransferHistory; // productId => transferIds
    mapping(address => uint256[]) public actorProducts; // owner => productIds
    
    // Arrays for enumeration
    address[] public actorList;
    uint256[] public productIds;
    
    // ============ Events ============
    
    event ActorRegistered(
        address indexed actorId,
        string name,
        ActorRole role,
        string location,
        uint256 timestamp
    );
    
    event ActorDeactivated(
        address indexed actorId,
        uint256 timestamp
    );
    
    event ProductCreated(
        uint256 indexed productId,
        string name,
        string category,
        address indexed manufacturer,
        uint256 timestamp
    );
    
    event ProductTransferred(
        uint256 indexed productId,
        uint256 indexed transferId,
        address indexed from,
        address to,
        string location,
        ProductStatus newStatus,
        uint256 timestamp
    );
    
    event ProductStatusUpdated(
        uint256 indexed productId,
        ProductStatus oldStatus,
        ProductStatus newStatus,
        uint256 timestamp
    );
    
    event ProductRecalled(
        uint256 indexed productId,
        string reason,
        address indexed recalledBy,
        uint256 timestamp
    );
    
    // ============ Modifiers ============
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }
    
    modifier onlyRegisteredActor() {
        require(actors[msg.sender].isActive, "Actor not registered or inactive");
        _;
    }
    
    modifier onlyManufacturer() {
        require(
            actors[msg.sender].role == ActorRole.Manufacturer && actors[msg.sender].isActive,
            "Only active manufacturers can call this function"
        );
        _;
    }
    
    modifier productExists(uint256 _productId) {
        require(_productId > 0 && _productId <= productCount, "Product does not exist");
        _;
    }
    
    modifier isProductOwner(uint256 _productId) {
        require(products[_productId].currentOwner == msg.sender, "Not the product owner");
        _;
    }
    
    modifier validTransfer(ActorRole _fromRole, ActorRole _toRole) {
        // Manufacturer -> Supplier
        if (_fromRole == ActorRole.Manufacturer) {
            require(_toRole == ActorRole.Supplier, "Manufacturer can only transfer to Supplier");
        }
        // Supplier -> Distributor
        else if (_fromRole == ActorRole.Supplier) {
            require(_toRole == ActorRole.Distributor, "Supplier can only transfer to Distributor");
        }
        // Distributor -> Retailer
        else if (_fromRole == ActorRole.Distributor) {
            require(_toRole == ActorRole.Retailer, "Distributor can only transfer to Retailer");
        }
        // Retailer -> Consumer
        else if (_fromRole == ActorRole.Retailer) {
            require(_toRole == ActorRole.Consumer, "Retailer can only transfer to Consumer");
        }
        else {
            revert("Invalid transfer path");
        }
        _;
    }
    
    // ============ Constructor ============
    
    constructor() {
        owner = msg.sender;
        productCount = 0;
        transferCount = 0;
    }
    
    // ============ Actor Management ============
    
    /**
     * @dev Register a new supply chain actor
     * @param _name Name of the actor/organization
     * @param _role Role in the supply chain
     * @param _location Physical location
     */
    function registerActor(
        string calldata _name,
        ActorRole _role,
        string calldata _location
    ) external {
        require(_role != ActorRole.None, "Invalid role");
        require(actors[msg.sender].id == address(0), "Actor already registered");
        require(bytes(_name).length > 0, "Name cannot be empty");
        
        actors[msg.sender] = Actor({
            id: msg.sender,
            name: _name,
            role: _role,
            location: _location,
            isActive: true,
            registeredAt: block.timestamp
        });
        
        actorList.push(msg.sender);
        
        emit ActorRegistered(
            msg.sender,
            _name,
            _role,
            _location,
            block.timestamp
        );
    }
    
    /**
     * @dev Deactivate an actor (admin only)
     * @param _actorId Address of the actor to deactivate
     */
    function deactivateActor(address _actorId) external onlyOwner {
        require(actors[_actorId].id != address(0), "Actor does not exist");
        require(actors[_actorId].isActive, "Actor already inactive");
        
        actors[_actorId].isActive = false;
        
        emit ActorDeactivated(_actorId, block.timestamp);
    }
    
    /**
     * @dev Get actor details
     */
    function getActor(address _actorId) external view returns (
        string memory name,
        ActorRole role,
        string memory location,
        bool isActive,
        uint256 registeredAt
    ) {
        require(actors[_actorId].id != address(0), "Actor does not exist");
        Actor memory actor = actors[_actorId];
        return (actor.name, actor.role, actor.location, actor.isActive, actor.registeredAt);
    }
    
    /**
     * @dev Get all registered actors
     */
    function getAllActors() external view returns (address[] memory) {
        return actorList;
    }
    
    // ============ Product Management ============
    
    /**
     * @dev Create a new product (Manufacturer only)
     * @param _name Product name
     * @param _description Product description
     * @param _category Product category
     */
    function createProduct(
        string calldata _name,
        string calldata _description,
        string calldata _category
    ) external onlyManufacturer returns (uint256) {
        require(bytes(_name).length > 0, "Product name cannot be empty");
        
        productCount++;
        
        products[productCount] = Product({
            id: productCount,
            name: _name,
            description: _description,
            category: _category,
            manufacturer: msg.sender,
            currentOwner: msg.sender,
            status: ProductStatus.Created,
            createdAt: block.timestamp,
            updatedAt: block.timestamp
        });
        
        productIds.push(productCount);
        actorProducts[msg.sender].push(productCount);
        
        emit ProductCreated(
            productCount,
            _name,
            _category,
            msg.sender,
            block.timestamp
        );
        
        return productCount;
    }
    
    /**
     * @dev Transfer product to next actor in supply chain
     * @param _productId ID of the product
     * @param _to Address of the recipient
     * @param _location Current location of transfer
     * @param _notes Additional notes
     */
    function transferProduct(
        uint256 _productId,
        address _to,
        string calldata _location,
        string calldata _notes
    ) 
        external 
        productExists(_productId) 
        isProductOwner(_productId)
        onlyRegisteredActor
    {
        Product storage product = products[_productId];
        Actor storage fromActor = actors[msg.sender];
        Actor storage toActor = actors[_to];
        
        require(toActor.isActive, "Recipient is not an active actor");
        require(_to != msg.sender, "Cannot transfer to self");
        require(product.status != ProductStatus.Recalled, "Cannot transfer recalled product");
        require(product.status != ProductStatus.Sold, "Cannot transfer sold product");
        
        // Validate transfer path
        ActorRole fromRole = fromActor.role;
        ActorRole toRole = toActor.role;
        
        // Special case: allow Manufacturer to transfer to themselves (for testing/special cases)
        // Otherwise, validate the supply chain flow
        if (fromRole != ActorRole.Manufacturer || toRole != ActorRole.Manufacturer) {
            require(
                (fromRole == ActorRole.Manufacturer && toRole == ActorRole.Supplier) ||
                (fromRole == ActorRole.Supplier && toRole == ActorRole.Distributor) ||
                (fromRole == ActorRole.Distributor && toRole == ActorRole.Retailer) ||
                (fromRole == ActorRole.Retailer && toRole == ActorRole.Consumer),
                "Invalid transfer: must follow supply chain path (Manufacturer->Supplier->Distributor->Retailer->Consumer)"
            );
        }
        
        // Create transfer record
        transferCount++;
        transfers[transferCount] = TransferRecord({
            id: transferCount,
            productId: _productId,
            from: msg.sender,
            to: _to,
            location: _location,
            notes: _notes,
            timestamp: block.timestamp
        });
        
        // Update product transfer history
        productTransferHistory[_productId].push(transferCount);
        
        // Update product ownership
        address previousOwner = product.currentOwner;
        product.currentOwner = _to;
        product.updatedAt = block.timestamp;
        
        // Update status
        ProductStatus newStatus = ProductStatus.InTransit;
        if (toRole == ActorRole.Retailer) {
            newStatus = ProductStatus.Delivered;
        } else if (toRole == ActorRole.Consumer) {
            newStatus = ProductStatus.Sold;
        }
        product.status = newStatus;
        
        // Update actor products
        actorProducts[_to].push(_productId);
        
        emit ProductTransferred(
            _productId,
            transferCount,
            previousOwner,
            _to,
            _location,
            newStatus,
            block.timestamp
        );
    }
    
    /**
     * @dev Update product status
     * @param _productId ID of the product
     * @param _newStatus New status
     */
    function updateProductStatus(
        uint256 _productId,
        ProductStatus _newStatus
    ) 
        external 
        productExists(_productId)
        isProductOwner(_productId)
    {
        Product storage product = products[_productId];
        ProductStatus oldStatus = product.status;
        
        require(oldStatus != _newStatus, "Status is already set to the new value");
        
        product.status = _newStatus;
        product.updatedAt = block.timestamp;
        
        emit ProductStatusUpdated(_productId, oldStatus, _newStatus, block.timestamp);
    }
    
    /**
     * @dev Recall a product
     * @param _productId ID of the product
     * @param _reason Reason for recall
     */
    function recallProduct(
        uint256 _productId,
        string calldata _reason
    ) 
        external 
        productExists(_productId)
    {
        Product storage product = products[_productId];
        
        // Only manufacturer or owner can recall
        require(
            msg.sender == product.manufacturer || msg.sender == owner,
            "Only manufacturer or owner can recall product"
        );
        
        product.status = ProductStatus.Recalled;
        product.updatedAt = block.timestamp;
        
        emit ProductRecalled(_productId, _reason, msg.sender, block.timestamp);
    }
    
    // ============ View Functions ============
    
    /**
     * @dev Get product details
     */
    function getProduct(uint256 _productId) 
        external 
        view 
        productExists(_productId)
        returns (
            uint256 id,
            string memory name,
            string memory description,
            string memory category,
            address manufacturer,
            address currentOwner,
            ProductStatus status,
            uint256 createdAt,
            uint256 updatedAt
        ) 
    {
        Product memory product = products[_productId];
        return (
            product.id,
            product.name,
            product.description,
            product.category,
            product.manufacturer,
            product.currentOwner,
            product.status,
            product.createdAt,
            product.updatedAt
        );
    }
    
    /**
     * @dev Get all product IDs
     */
    function getAllProductIds() external view returns (uint256[] memory) {
        return productIds;
    }
    
    /**
     * @dev Get products owned by an actor
     */
    function getProductsByOwner(address _owner) external view returns (uint256[] memory) {
        return actorProducts[_owner];
    }
    
    /**
     * @dev Get transfer history for a product
     */
    function getProductTransferHistory(uint256 _productId) 
        external 
        view 
        productExists(_productId)
        returns (uint256[] memory) 
    {
        return productTransferHistory[_productId];
    }
    
    /**
     * @dev Get transfer record details
     */
    function getTransferRecord(uint256 _transferId) external view returns (
        uint256 id,
        uint256 productId,
        address from,
        address to,
        string memory location,
        string memory notes,
        uint256 timestamp
    ) {
        require(_transferId > 0 && _transferId <= transferCount, "Transfer does not exist");
        TransferRecord memory transfer = transfers[_transferId];
        return (
            transfer.id,
            transfer.productId,
            transfer.from,
            transfer.to,
            transfer.location,
            transfer.notes,
            transfer.timestamp
        );
    }
    
    /**
     * @dev Get total counts
     */
    function getCounts() external view returns (
        uint256 totalProducts,
        uint256 totalTransfers,
        uint256 totalActors
    ) {
        return (productCount, transferCount, actorList.length);
    }
}

