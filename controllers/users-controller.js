const { validationResult } = require("express-validator");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const HttpError = require("../models/http-error");
const User = require("../models/user");

const getUsers = async (req, res, next) => {
  let users;
  try {
    users = await User.find({}, "-password");
  } catch (error) {
    return next(new HttpError("Failed fetching users, please try again", 500));
  }
  res.json({ users: users.map((user) => user.toObject({ getters: true })) });
};

const signup = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return next(
      new HttpError("Invalid inputs passed, please check your data.", 422),
    );

  const { name, email, password } = req.body;

  let exsistingUser;
  try {
    exsistingUser = await User.findOne({ email: email });
  } catch (error) {
    return next(new HttpError("Sign up failed, please try again later", 500));
  }

  if (exsistingUser) {
    return next(
      new HttpError("User exists already, please login instead", 422),
    );
  }

  let hashedPassword;
  try {
    hashedPassword = await bcrypt.hash(password, 12);
  } catch (error) {
    return next(new HttpError("Could not create user, please try again", 500));
  }
  const newUser = new User({
    name,
    email,
    image: req.file.path,
    password: hashedPassword,
    places: [],
  });

  try {
    await newUser.save();
  } catch (error) {
    const httpError = new HttpError(
      "Creating new user failed, please try again.",
      500,
    );
    return next(httpError);
  }

  let token;
  try {
    token = jwt.sign(
      { userId: newUser.id, email: newUser.email },
      process.env.JWT_KEY,
      { expiresIn: "1h" },
    );
  } catch (error) {
    return next(
      new HttpError("Signing up failed, please try again later", 500),
    );
  }

  res
    .status(201)
    .json({ userId: newUser.id, email: newUser.email, token: token });
};

const login = async (req, res, next) => {
  const { email, password } = req.body;

  let exsistingUser;
  try {
    exsistingUser = await User.findOne({ email: email });
  } catch (error) {
    return next(
      new HttpError("Logging in failed, please try again later", 500),
    );
  }

  if (!exsistingUser) {
    return next(new HttpError("Invalid credentials, please try again", 403));
  }

  let isValidPassword = false;
  try {
    isValidPassword = await bcrypt.compare(password, exsistingUser.password);
  } catch (error) {
    return next(
      new HttpError("Could not log you in, please check your credentials", 500),
    );
  }

  if (!isValidPassword) {
    return next(new HttpError("Invalid credentials, please try again", 403));
  }

  let token;
  try {
    token = jwt.sign(
      {
        userId: exsistingUser.id,
        email: exsistingUser.email,
      },
      process.env.JWT_KEY,
      { expiresIn: "1h" },
    );
  } catch (error) {
    return next(
      new HttpError("Logging in failed, please try again later", 500),
    );
  }

  res.json({
    userId: exsistingUser.id,
    email: exsistingUser.email,
    token: token,
  });
};

exports.getUsers = getUsers;
exports.signup = signup;
exports.login = login;
