import { Schema, model, InferSchemaType } from 'mongoose';
import { TEAMS, USER_ROLES } from '../config/constants';

// Login accounts: one admin plus one per team (FR-1.2)
const userSchema = new Schema(
  {
    username: { type: String, required: true, unique: true, trim: true, lowercase: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: USER_ROLES, required: true },
    team: { type: String, enum: TEAMS }, // required when role === 'team'
    // Bumped whenever credentials change, so existing JWTs stop working (FR-1.6)
    tokenVersion: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      transform: (_doc: unknown, ret: Record<string, unknown>) => {
        ret.id = String(ret._id);
        delete ret._id;
        delete ret.passwordHash;
        delete ret.tokenVersion;
        return ret;
      },
    },
  },
);

export type UserDoc = InferSchemaType<typeof userSchema>;
export const User = model('User', userSchema);
