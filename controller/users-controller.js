const HttpError = require("../models/http-error");
const { validationResult } = require("express-validator");
const bcryptjs = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/user");

const getUsers = async (req, res, next) => {
  let users;
  try {
    users = await User.find({}, "-password");
  } catch (err) {
    return next(new HttpError("somthing went wrong, users not found"), 500);
  }
  res
    .status(201)
    .json({ users: users.map((user) => user.toObject({ getters: true })) });
};

const signup = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new HttpError("please insert a valid inputs", 422));
  }
  const { name, email, password } = req.body;

  let userExist;
  try {
    userExist = await User.findOne({ email: email });
  } catch (err) {
    const error = new HttpError("Signing up failed, please try later", 500);
    return next(error);
  }
  if (userExist) {
    const error = new HttpError("User already Exist", 422);
    return next(error);
  }

  let hashPassword;
  try {
    hashPassword = await bcryptjs.hash(password, 12);
  } catch (err) {
    const error = new HttpError(
      "signup failed, could not hashing password",
      500
    );
    return next(error);
  }

  const newUser = new User({
    name,
    email,
    password: hashPassword,
    image: req.file.path,
    places: [],
  });
  console.log(newUser);

  try {
    await newUser.save();
  } catch (err) {
    const error = new HttpError("#signup failed, please try again later", 500);
    return next(error);
  }
  let token;
  try {
    token = jwt.sign(
      { userId: newUser.id, email: newUser.email },
      "secret_private_token",
      { expiresIn: "1h" }
    );
  } catch (err) {
    const error = new HttpError("somthing went wrong - token", 401);
    return next(error);
  }

  res.status(201).json({ userId: newUser.id, email: newUser.email, token });
};

const login = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new HttpError("please insert a valid inputs", 422));
  }
  const { email, password } = req.body;
  let loginUser;
  try {
    loginUser = await User.findOne({ email: email });
  } catch (err) {
    const error = new HttpError("Logging in failed, wrong email", 500);
    return next(error);
  }
  if (!loginUser) {
    const error = new HttpError("Wrong email or Password", 401);
    return next(error);
  }

  let isValidPassword = false;
  try {
    isValidPassword = await bcryptjs.compare(password, loginUser.password);
  } catch (err) {
    const error = new HttpError(
      "somthing went wrong, please try again later",
      401
    );
    return next(error);
  }

  if (!isValidPassword) {
    const error = new HttpError("Wrong Password", 401);
    return next(error);
  }

  let token;
  try {
    token = jwt.sign(
      { userId: loginUser.id, email: loginUser.email },
      process.env.JWT_KEY,
      { expiresIn: "1h" }
    );
  } catch (err) {
    const error = new HttpError("somthing went wrong - token", 401);
    return next(error);
  }

  res.status(200).json({
    userId: loginUser.id,
    email: loginUser.email,
    token,
  });
};

exports.getUsers = getUsers;
exports.signup = signup;
exports.login = login;
