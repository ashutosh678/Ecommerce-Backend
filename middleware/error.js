const ErrorHandler = require("../utils/errorhander");

module.exports = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal server error";

  // Handle Mongoose CastError
  if (err.name === "CastError") {
    const castMessage = `Resource not found. Invalid: ${err.path}`;
    err = new ErrorHandler(castMessage, 400);
  }

  // Mongoose Duplicate Key error
  if (err.code === 11000) {
    const duplicateMessage = `Duplicate ${Object.keys(err.keyValue)} entered.`;
    err = new ErrorHandler(duplicateMessage, 400);
  }

    // Wrong JWT error
    if (err.name === "JsonWebTokenError") {
      const message = `Json Web Token is invalid, Try again `;
      err = new ErrorHandler(message, 400);
    }

  // Wrong JWT error
  if (err.name === "TokenExpiredError") {
    const tokenMessage = `JSON web token is expired. Please try again.`;
    err = new ErrorHandler(tokenMessage, 400);
  }

  res.status(statusCode).json({
    success: false,
    error: err.message
  });
};
