import { Schema, model, InferSchemaType } from 'mongoose';
import { ROLES, TEAMS, YEARS } from '../config/constants';
import { normalizeRole, normalizeRollNo, normalizeTeam, normalizeYear } from '../utils/normalize';
import { toJSONOptions } from './toJSON';

// Setters apply the same rules as the validators, so writes that bypass the API
// (scripts, future code) are normalized too.
const setter =
  <R>(fn: (v: string) => R) =>
  (v: unknown) =>
    typeof v === 'string' && v.trim() ? fn(v) : v;

// FR-2.1: id, name, role, team, optional rollNo/department/year/phone, updatedAt
const memberSchema = new Schema(
  {
    _id: { type: Schema.Types.Mixed, required: true }, // custom-{timestamp}-{random} (FR-2.4)
    name: { type: String, required: true, trim: true },
    role: { type: String, enum: ROLES, required: true, set: setter(normalizeRole) },
    team: { type: String, enum: TEAMS, required: true, index: true, set: setter(normalizeTeam) },
    rollNo: { type: String, index: true, set: setter(normalizeRollNo) }, // "24pf12" -> "24PF12"
    department: { type: String, trim: true },
    year: { type: String, enum: YEARS, set: setter(normalizeYear) },
    phone: { type: String, trim: true },
    photo: { type: String, trim: true }, // Optional photo URL
  },
  { timestamps: true, versionKey: false, toJSON: toJSONOptions },
);

memberSchema.index({ name: 1 });

export type MemberDoc = InferSchemaType<typeof memberSchema>;
export const Member = model('Member', memberSchema);