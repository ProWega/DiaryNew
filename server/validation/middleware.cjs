const { z } = require("zod");

function formatZodIssues(error) {
  return error.issues.map((issue) => ({
    path: Array.isArray(issue.path) ? issue.path.join(".") : String(issue.path || ""),
    message: issue.message,
    code: issue.code,
  }));
}

/**
 * Express middleware factory that validates `req.body` against a zod schema.
 * On success, replaces `req.body` with the parsed (and stripped) value so
 * downstream handlers see only known fields. On failure, responds with 400
 * and a structured `errors` array.
 */
function validateBody(schema) {
  if (!(schema instanceof z.ZodType)) {
    throw new Error("validateBody requires a zod schema");
  }
  return (req, res, next) => {
    const result = schema.safeParse(req.body ?? {});
    if (!result.success) {
      res.status(400).json({
        message: "Некорректные данные запроса",
        errors: formatZodIssues(result.error),
      });
      return;
    }
    req.body = result.data;
    next();
  };
}

module.exports = { validateBody };
