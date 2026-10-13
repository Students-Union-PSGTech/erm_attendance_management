const fs = require('fs');
const file = 'src/controllers/members.controller.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace("import type { Request, Response } from 'express';", "import type { Request, Response } from 'express';\nimport { Types } from 'mongoose';");

code = code.replace(
  "const member = await Member.findOne({ _id: id, ...(team && { team }) });",
  "const _id = Types.ObjectId.isValid(id) ? { $in: [id, new Types.ObjectId(id)] } : id;\n  const member = await Member.findOne({ _id, ...(team && { team }) });"
);

code = code.replace(
  "const member = await Member.findByIdAndUpdate(id, { $set: update }, { new: true, runValidators: true });",
  "const _id = Types.ObjectId.isValid(id) ? { $in: [id, new Types.ObjectId(id)] } : id;\n  const member = await Member.findOneAndUpdate({ _id }, { $set: update }, { new: true, runValidators: true });"
);

code = code.replace(
  "const deleted = await Member.findByIdAndDelete(id);",
  "const _id = Types.ObjectId.isValid(id) ? { $in: [id, new Types.ObjectId(id)] } : id;\n  const deleted = await Member.findOneAndDelete({ _id });"
);

fs.writeFileSync(file, code);
