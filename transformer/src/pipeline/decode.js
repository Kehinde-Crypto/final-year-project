import { getActorRoleName, getProductStatusName } from '../constants.js';

/**
 * Decodes raw blockchain events into structured data
 */
export function decodeEvent(event) {
  const { eventName, args, blockNumber, transactionHash, logIndex } = event;

  const decoded = {
    meta: {
      blockNumber,
      transactionHash,
      logIndex,
      timestamp: Date.now(),
    },
    type: eventName,
    data: {},
  };

  switch (eventName) {
    case 'ActorRegistered':
      decoded.data = {
        actorId: args.actorId,
        name: args.name,
        role: Number(args.role),
        roleName: getActorRoleName(Number(args.role)),
        location: args.location,
        timestamp: Number(args.timestamp),
      };
      break;

    case 'ActorDeactivated':
      decoded.data = {
        actorId: args.actorId,
        timestamp: Number(args.timestamp),
      };
      break;

    case 'ProductCreated':
      decoded.data = {
        productId: Number(args.productId),
        name: args.name,
        category: args.category,
        manufacturer: args.manufacturer,
        timestamp: Number(args.timestamp),
      };
      break;

    case 'ProductTransferred':
      decoded.data = {
        productId: Number(args.productId),
        transferId: Number(args.transferId),
        from: args.from,
        to: args.to,
        location: args.location,
        newStatus: Number(args.newStatus),
        statusName: getProductStatusName(Number(args.newStatus)),
        timestamp: Number(args.timestamp),
      };
      break;

    case 'ProductStatusUpdated':
      decoded.data = {
        productId: Number(args.productId),
        oldStatus: Number(args.oldStatus),
        oldStatusName: getProductStatusName(Number(args.oldStatus)),
        newStatus: Number(args.newStatus),
        newStatusName: getProductStatusName(Number(args.newStatus)),
        timestamp: Number(args.timestamp),
      };
      break;

    case 'ProductRecalled':
      decoded.data = {
        productId: Number(args.productId),
        reason: args.reason,
        recalledBy: args.recalledBy,
        timestamp: Number(args.timestamp),
      };
      break;

    default:
      console.warn(`[Decoder] Unknown event type: ${eventName}`);
      decoded.data = { raw: args };
  }

  return decoded;
}
