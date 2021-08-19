const express = require("express");
const { check } = require("express-validator");
const fileUpload = require("../middleware/file-upload");

const userController = require("../controller/users-controller");
const routes = express.Router();

routes.get("/", userController.getUsers);

routes.post(
  "/signup",
  fileUpload.single("image"),
  [
    check("email").normalizeEmail().isEmail(),
    check("password").isLength({ min: 6 }),
    check("name").not().isEmpty(),
  ],
  userController.signup
);

routes.post(
  "/login",
  [check("email").not().isEmpty(), check("password").not().isEmpty()],
  userController.login
);

module.exports = routes;
