const fs = require('fs');
const file = 'src/controllers/sessions.controller.ts';
let code = fs.readFileSync(file, 'utf8');

if (!code.includes("import { Types } from 'mongoose';")) {
  code = code.replace("import type { Request, Response } from 'express';", "import type { Request, Response } from 'express';\nimport { Types } from 'mongoose';");
}

code = code.replace(
  "const found = await Member.find({ _id: { $in: ids } }, { _id: 1, team: 1 }).lean();",
  "const queryIds = ids.flatMap(id => Types.ObjectId.isValid(id) ? [id, new Types.ObjectId(id)] : [id]);\n  const found = await Member.find({ _id: { $in: queryIds } }, { _id: 1, team: 1 }).lean();"
);

code = code.replace(
  "const member = await Member.findById(memberId, { team: 1 }).lean();",
  "const _memberId = Types.ObjectId.isValid(memberId) ? { $in: [memberId, new Types.ObjectId(memberId)] } : memberId;\n  const member = await Member.findOne({ _id: _memberId }, { team: 1 }).lean();"
);

fs.writeFileSync(file, code);
