// Shared toJSON options: expose `id` instead of `_id`, drop internals.
export const toJSONOptions = {
  flattenMaps: true,
  versionKey: false,
  transform: (_doc: unknown, ret: Record<string, unknown>) => {
    ret.id = ret._id;
    delete ret._id;
    return ret;
  },
};
