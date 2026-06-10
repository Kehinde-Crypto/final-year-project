import Joi from 'joi';

// Validation schemas for each event type
const schemas = {
  ActorRegistered: Joi.object({
    actorId: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).required(),
    name: Joi.string().min(1).max(200).required(),
    role: Joi.number().integer().min(1).max(5).required(),
    roleName: Joi.string().required(),
    location: Joi.string().max(200).required(),
    timestamp: Joi.number().positive().required(),
  }),

  ActorDeactivated: Joi.object({
    actorId: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).required(),
    timestamp: Joi.number().positive().required(),
  }),

  ProductCreated: Joi.object({
    productId: Joi.number().positive().required(),
    name: Joi.string().min(1).max(200).required(),
    category: Joi.string().max(100).required(),
    manufacturer: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).required(),
    timestamp: Joi.number().positive().required(),
  }),

  ProductTransferred: Joi.object({
    productId: Joi.number().positive().required(),
    transferId: Joi.number().positive().required(),
    from: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).required(),
    to: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).required(),
    location: Joi.string().max(200).allow('').required(),
    newStatus: Joi.number().integer().min(0).max(4).required(),
    statusName: Joi.string().required(),
    timestamp: Joi.number().positive().required(),
  }),

  ProductStatusUpdated: Joi.object({
    productId: Joi.number().positive().required(),
    oldStatus: Joi.number().integer().min(0).max(4).required(),
    oldStatusName: Joi.string().required(),
    newStatus: Joi.number().integer().min(0).max(4).required(),
    newStatusName: Joi.string().required(),
    timestamp: Joi.number().positive().required(),
  }),

  ProductRecalled: Joi.object({
    productId: Joi.number().positive().required(),
    reason: Joi.string().max(500).required(),
    recalledBy: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).required(),
    timestamp: Joi.number().positive().required(),
  }),
};

/**
 * Validates decoded event data
 * @returns { valid: boolean, error?: string, data: object }
 */
export function validateEvent(decodedEvent) {
  const { type, data } = decodedEvent;
  
  const schema = schemas[type];
  if (!schema) {
    return { 
      valid: false, 
      error: `No validation schema for event type: ${type}`,
      data 
    };
  }

  const { error, value } = schema.validate(data, { 
    stripUnknown: true,
    abortEarly: false,
  });

  if (error) {
    const details = error.details.map(d => d.message).join('; ');
    return { 
      valid: false, 
      error: details,
      data 
    };
  }

  return { valid: true, data: value };
}
