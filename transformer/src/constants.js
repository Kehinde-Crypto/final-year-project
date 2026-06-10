// Actor roles enum matching Solidity
export const ActorRole = {
  0: 'None',
  1: 'Manufacturer',
  2: 'Supplier',
  3: 'Distributor',
  4: 'Retailer',
  5: 'Consumer',
};

// Product status enum matching Solidity
export const ProductStatus = {
  0: 'Created',
  1: 'InTransit',
  2: 'Delivered',
  3: 'Sold',
  4: 'Recalled',
};

// Event names we listen to
export const EVENTS = {
  ACTOR_REGISTERED: 'ActorRegistered',
  ACTOR_DEACTIVATED: 'ActorDeactivated',
  PRODUCT_CREATED: 'ProductCreated',
  PRODUCT_TRANSFERRED: 'ProductTransferred',
  PRODUCT_STATUS_UPDATED: 'ProductStatusUpdated',
  PRODUCT_RECALLED: 'ProductRecalled',
};

// Reverse lookup
export const getActorRoleName = (role) => ActorRole[role] || 'Unknown';
export const getProductStatusName = (status) => ProductStatus[status] || 'Unknown';
