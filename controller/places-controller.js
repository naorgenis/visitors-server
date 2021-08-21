const uuid = require("uuid");
const { validationResult } = require("express-validator");
const location = require("../util/location");
const HttpError = require("../models/http-error");
const Place = require("../models/place");
const User = require("../models/user");
const mongoos = require("mongoose");
const fs = require("fs");

const getPlaceById = async (req, res, next) => {
  const placeId = req.params.pid;

  let place;
  try {
    place = await Place.findById(placeId);
  } catch (err) {
    const error = HttpError(
      "Somthing went wrong, could not find the place by Id",
      500
    );
    return next(error);
  }
  if (!place) {
    const error = new HttpError(
      "Could not find the place for the provided Id",
      404
    );
    return next(error);
  }

  res.json({ place: place.toObject({ getters: true }) });
};

const getPlacesByUserId = async (req, res, next) => {
  const userId = req.params.uid;
  let userPlaces;
  try {
    userPlaces = await Place.find({ creator: userId });
  } catch (err) {
    const error = HttpError("Fetching place failed, please try later", 500);
    return next(error);
  }

  if (userPlaces.length === 0) {
    const error = new HttpError(
      "Could not find the place for the provided user id",
      404
    );
    return next(error);
  }

  res.json({
    userPlaces: userPlaces.map((places) => places.toObject({ getters: true })),
  });
};

const createPlace = async (req, res, next) => {
  const errors = validationResult(req);
  console.log(errors);
  if (!errors.isEmpty()) {
    return next(new HttpError("Invalid inputs, Please check your data", 422));
  }
  const { title, address, description } = req.body;
  if (!req.file) {
    const error = new HttpError("Please choose an image", 422);
    return next(error);
  }

  let coordinates;
  try {
    coordinates = await location.getCoordsForAddress(address);
  } catch (error) {
    return next(error);
  }

  const createdPlace = new Place({
    title,
    description,
    address,
    location: coordinates,
    image: req.file.path,
    creator: req.userData.userId,
  });

  let user;
  try {
    user = await User.findById(req.userData.userId);
  } catch (err) {
    const error = new HttpError("creating place failed, please try again", 500);
    return next(error);
  }

  if (!user) {
    const error = new HttpError(
      "creating place failed, user does not exist",
      404
    );
    return next(error);
  }

  try {
    const sess = await mongoos.startSession();
    sess.startTransaction();
    await createdPlace.save({ session: sess });
    user.places.push(createdPlace);
    await user.save({ session: sess });
    await sess.commitTransaction();
  } catch (err) {
    const error = new HttpError("creating place failed, please try again", 500);
    return next(error);
  }
  res.status(201).json({ place: createdPlace });
};

const detetePlace = async (req, res, next) => {
  const placeId = req.params.pid;
  let place;
  try {
    place = await Place.findById(placeId).populate("creator");
  } catch (err) {
    const error = new HttpError(
      "somthing went wrong, could not find the place",
      500
    );
    return next(error);
  }

  if (!place) {
    const error = new HttpError(
      " could not delete a place who dont exist",
      404
    );
    return next(error);
  }

  if (place.creator.id !== req.userData.userId) {
    const error = new HttpError(
      "You are not allowed to delete this place",
      500
    );
    return next(error);
  }

  const imagePath = place.image;

  try {
    const sess = await mongoos.startSession();
    sess.startTransaction();
    await place.remove({ session: sess });
    place.creator.places.pull(place);
    await place.creator.save({ session: sess });
    await sess.commitTransaction();
  } catch {
    const error = new HttpError(
      "somthing went wrong, could not delete the place",
      500
    );
    return next(error);
  }

  fs.unlink(imagePath, (err) => {
    console.log(err);
  });

  res.status(200).json({ message: "place has been deleted" });
};

const updatePlace = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new HttpError("Invalid inputs, Please check your data", 422));
  }
  const placeId = req.params.pid;
  const { title, description } = req.body;
  let place;
  try {
    place = await Place.findById(placeId);
  } catch (err) {
    const error = new HttpError(
      "Somthing went wrong, could not find the place by Id",
      500
    );
    return next(error);
  }

  if (place.creator.toString() !== req.userData.userId) {
    const error = new HttpError("You are not allowed to edit this place", 401);
    return next(error);
  }

  place.title = title;
  place.description = description;

  try {
    await place.save();
  } catch (err) {
    const error = HttpError("Somthing went wrong, could not update place", 500);
    return next(error);
  }

  res.status(200).json({ place: place.toObject({ getters: true }) });
};

exports.getPlaceById = getPlaceById;
exports.getPlacesByUserId = getPlacesByUserId;
exports.createPlace = createPlace;
exports.detetePlace = detetePlace;
exports.updatePlace = updatePlace;
