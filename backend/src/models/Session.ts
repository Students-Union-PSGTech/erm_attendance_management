import { Schema, model, InferSchemaType } from 'mongoose';
import { ATTENDANCE_STATUSES, SESSION_SLOTS, SESSION_TEAMS } from '../config/constants';
import { TIME_PATTERN } from '../utils/normalize';
import { toJSONOptions } from './toJSON';


const attendanceEntrySchema = new Schema(
  {
    status: { type: String, enum: ATTENDANCE_STATUSES, required: true },
    notes: { type: String, trim: true },
    markedAt: { type: String }, 
  },
  { _id: false },
);


const sessionSchema = new Schema(
  {
    _id: { type: String, required: true },
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ }, // YYYY-MM-DD
    startTime: { type: String, required: true, match: TIME_PATTERN }, // HH:mm, 24-hour
    endTime: { type: String, match: TIME_PATTERN }, // HH:mm, optional
    sessionSlot: { type: String, enum: SESSION_SLOTS, required: true },
    title: { type: String, required: true, trim: true },
    team: { type: String, required: true, default: 'ALL' },
    records: { type: Map, of: attendanceEntrySchema, default: {} }, // memberId -> entry
    notes: { type: String, trim: true },
    createdBy: { type: String, required: true },
  },
  { timestamps: true, versionKey: false, toJSON: toJSONOptions },
);

sessionSchema.index({ date: -1, startTime: -1 });
sessionSchema.index({ team: 1, date: -1 });

export type SessionDoc = InferSchemaType<typeof sessionSchema>;
export const AttendanceSession = model('AttendanceSession', sessionSchema, 'sessions');