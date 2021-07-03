let router = require("express").Router();

let { User, Event, Notification } = require("../Models");

let bcrypt = require("bcryptjs");
let multer = require("multer");
let dayjs = require("dayjs");

let { UNEXPECTED_ERROR } = require("../constants");
let { isEmpty, sanitizeObject } = require("../utils");

/*
Configuring the multer middleware(parses multi-part formdata such as images,pdfs,videos) for storing
profile pictures and event pictures.
*/

var eventStorage = multer.diskStorage({
	destination: function (req, file, cb) {
		cb(null, "./public/eventImages");
	},
	filename: function (req, file, cb) {
		let [filename, ext] = file.originalname.split(".");
		req.filename = `${req.user.email}-${filename}-${Date.now()}.${ext}`;
		cb(null, req.filename);
	},
});

var eventUpload = multer({ storage: eventStorage });

var profileStorage = multer.diskStorage({
	destination: function (req, file, cb) {
		cb(null, "./public/profileImages");
	},
	filename: function (req, file, cb) {
		let [filename, ext] = file.originalname.split(".");
		req.filename = `${req.body.email}.${ext}`;
		cb(null, req.filename);
	},
});

var profileUpload = multer({ storage: profileStorage });

/*
This route is used to update user's profile
*/
router.post("/updateProfile", profileUpload.any(), (req, res) => {
	let { fname, lname, password, email, image } = req.body;
	let updatedProfile = {
		fname,
		lname,
		password,
		email,
		profileImg: req.filename || image, // check if there is a new file uploaded otherwise, keep on using the old filename
	};

	User.findByIdAndUpdate(req.user._id, updatedProfile, { new: true })
		.lean()
		.then((user) => {
			res.send({
				status: true,
				msg: "Your Profile has been updated",
				appearance: "success",
				user,
			});
		})
		.catch(() => {
			res.send({
				status: false,
				msg: UNEXPECTED_ERROR,
				appearance: "error",
			});
		});
});

/*
This route is used to create an event
*/
router.post("/createEvent", eventUpload.any(), (req, res) => {
	let {
		name,
		zipcode,
		description,
		start,
		end,
		numberOfVolunteersRequired,
		volunteers,
	} = req.body;
	let volunteersArray = JSON.parse(volunteers);
	if (volunteersArray.length > numberOfVolunteersRequired) {
		return res.send({
			status: false,
			msg:
				"The number of volunteers are more than the number specified. Kindly adjust the number of volunteers",
			appearance: "error",
		});
	} else {
		/*
		Converting start and end date to their appropriate MongoDB expected format
		*/
		let newEvent = new Event({
			name,
			zipcode,
			start: dayjs(start).format(),
			end: dayjs(end).format(),
			description,
			numberOfVolunteersRequired,
			image: req.filename,
			organizer: req.user.email,
			volunteers: volunteersArray.map((volunteer) => volunteer.value),
		});
		newEvent
			.save()
			.then(() => {
				return res.send({
					status: true,
					msg: "New event has been added",
					appearance: "success",
				});
			})
			.catch(() => {
				return res.send({
					status: false,
					msg: UNEXPECTED_ERROR,
					appearance: "error",
				});
			});
	}
});

/*
This route is used to update an event
*/
router.post("/updateEvent", eventUpload.any(), (req, res) => {
	let {
		id,
		name,
		zipcode,
		description,
		start,
		end,
		numberOfVolunteersRequired,
		image,
		volunteers,
	} = req.body;
	let volunteersArray = JSON.parse(volunteers);
	if (volunteersArray.length >= numberOfVolunteersRequired) {
		return res.send({
			status: false,
			msg:
				"The number of volunteers are more than the number specified. Kindly adjust the number of volunteers",
			appearance: "error",
		});
	} else {
		/*
			Converting start and end date to their appropriate MongoDB expected format
		*/
		let updatedEvent = {
			name,
			zipcode,
			description,
			start: dayjs(start).format(),
			end: dayjs(end).format(),
			numberOfVolunteersRequired,
			image: req.filename || image, // check if there is a new file uploaded otherwise, keep on using the old filename
			volunteers: volunteersArray.map((volunteer) => volunteer.value),
		};
		Event.findByIdAndUpdate(id, updatedEvent, { new: true })
			.lean()
			.then((updateEventObj) => {
				res.send({
					status: true,
					msg: "Event has been updated",
					appearance: "success",
				});
			})
			.catch(() => {
				res.send({
					status: false,
					msg: UNEXPECTED_ERROR,
					appearance: "error",
				});
			});
	}
});

/*
This route fetches an event based on its IDs
*/
router.post("/event", (req, res) => {
	let { id } = req.body;
	Event.findById(id)
		.lean()
		.then((event) => {
			/*
			Converting start and end date to their appropriate frontend expected format

			The component for populating volunteers expects data in the format 
			[{value1,label1},{value2,label2},...] where label is shown in the component while 
			value is the value of that array item so converting it into that
			*/
			res.send({
				status: true,
				event: {
					...event,
					start: dayjs(event.start).format("YYYY-MM-DD"),
					end: dayjs(event.end).format("YYYY-MM-DD"),
					volunteers: event.volunteers.map((option) => ({
						value: option,
						label: option,
					})),
				},
			});
		})
		.catch((err) => {
			res.send({
				status: false,
				msg: UNEXPECTED_ERROR,
				appearance: "error",
				err,
			});
		});
});

/*
This route only fetches those events from the DB who do not have
1) The logged in user as the volunteer(in case of a volunteer)
2) The loggeed in user as the event organizer(in case of a charity)
*/
router.get("/events", (req, res) => {
	Event.find(
		req.user.role == "charity"
			? { organizer: { $ne: req.user.email } }
			: { volunteers: { $ne: req.user.email } }
	)
		.lean()
		.sort({ createdAt: -1 })
		.then((events) => {
			/*
			Converting start and end date to their appropriate frontend expected format
			*/
			res.send({
				status: true,
				events: events.map((event) => {
					return {
						...event,
						start: dayjs(event.start).format("YYYY-MM-DD"),
						end: dayjs(event.end).format("YYYY-MM-DD"),
					};
				}),
			});
		})
		.catch((err) => {
			res.send({
				status: false,
				msg: UNEXPECTED_ERROR,
				appearance: "error",
				err,
			});
		});
});

/*
This route only fetches those events from the DB who have
1) The logged in user as the volunteer(in case of a volunteer)
2) The loggeed in user as the event organizer(in case of a charity)
*/
router.get("/myEvents", (req, res) => {
	Event.find(
		req.user.role == "charity"
			? { organizer: req.user.email }
			: { volunteers: req.user.email }
	)
		.lean()
		.sort({ createdAt: -1 })
		.then((events) => {
			/*
			Converting start and end date to their appropriate frontend expected format
			*/
			res.send({
				status: true,
				events: events.map((event) => {
					return {
						...event,
						start: dayjs(event.start).format("YYYY-MM-DD"),
						end: dayjs(event.end).format("YYYY-MM-DD"),
					};
				}),
			});
		})
		.catch(() => {
			res.send({
				status: false,
				msg: UNEXPECTED_ERROR,
				appearance: "error",
			});
		});
});

/*
This route is used to delete an event
*/
router.post("/deleteEvent", (req, res) => {
	let { id } = req.body;

	Event.findOneAndDelete({ _id: id, organizer: req.user.email })
		.then((_) => {
			res.send({
				status: true,
				msg: "Event Deleted",
				appearance: "success",
			});
		})
		.catch((err) => {
			res.send({
				status: false,
				msg: UNEXPECTED_ERROR,
				appearance: "error",
			});
		});
});

/*
This route searches events based on the filters name, zipcode, start, end
*/
router.post("/searchEvents", (req, res) => {
	let { name, zipcode, start, end } = req.body;

	/*
	For the properties where we have used the isEmpty checks,we dont want to apply those RegExp 
	and less than/greater than filters if the value is empty

	Also as we would not want to search the events concerning us, as we already know about those, we
	would skip those
	*/
	let eventToFind = {
		name: isEmpty(name) ? "" : new RegExp(name, "i"),
		zipcode,
		start: isEmpty(start) ? "" : { $lt: start },
		end: isEmpty(end) ? "" : { $gt: end },
		...(req.user.role == "charity"
			? { organizer: { $ne: req.user.email } }
			: { volunteers: { $ne: req.user.email } }),
	};

	Event.find(sanitizeObject(eventToFind))
		.sort({ createdAt: -1 })
		.lean()
		.then((events) => {
			res.send({
				status: true,
				events: events.map((event) => {
					return {
						...event,
						start: dayjs(event.start).format("YYYY-MM-DD"),
						end: dayjs(event.end).format("YYYY-MM-DD"),
					};
				}),
			});
		})
		.catch((err) => {
			res.send({
				status: false,
				msg: UNEXPECTED_ERROR,
				appearance: "error",
				err,
			});
		});
});

/*
This route sends a notification to the event organizer prompting him to accept or deny the 
vounteering request
*/
router.post("/sendVolunteeringRequest", (req, res) => {
	let { organizer, id, name } = req.body;

	let newNotification = new Notification({
		to: organizer,
		from: req.user.email,
		message: `Hi, ${req.user.email} wants to be a volunteer for ${name} event`,
		eventID: id,
		type: "VOLUNTEERING_REQUEST",
		seen: false,
	});

	newNotification
		.save()
		.then((_) => {
			res.send({
				status: true,
				msg: `Congrats, A notification has been sent to ${organizer} for ${name} event`,
				appearance: "success",
			});
		})
		.catch((err) => {
			res.send({
				status: false,
				msg: UNEXPECTED_ERROR,
				appearance: "error",
				err,
			});
		});
});

/*
This route fetches the top 5 latest notifications of that particular person
*/
router.get("/notifications", (req, res) => {
	Notification.find({ to: req.user.email })
		.limit(5)
		.sort({ createdAt: -1 })
		.then((notifications) => {
			res.send({
				status: true,
				notifications,
				numberOfUnseenNotifications:
					notifications?.filter(
						(notification) => notification.seen == false
					)?.length || 0,
			});
		})
		.catch((err) => {
			res.send({
				status: false,
				msg: UNEXPECTED_ERROR,
				appearance: "error",
				err,
			});
		});
});

/*
This route changes all notifications of that particular person to seen
*/
router.get("/seeNotifications", (req, res) => {
	Notification.updateMany({ to: req.user.email }, { seen: true })
		.then((notifications) => {
			res.send({
				status: true,
				notifications,
			});
		})
		.catch((err) => {
			res.send({
				status: false,
				msg: UNEXPECTED_ERROR,
				appearance: "error",
				err,
			});
		});
});

/*
When an event organizer accepts or denies an event, this route gets triggered
We then perform an action based on if the request was denied or accepted.
*/
router.post("/handleVolunteeringRequest", (req, res) => {
	let { notificationId, action } = req.body;
	Notification.findByIdAndUpdate(
		notificationId,
		{ catered: true },
		{ new: true }
	)
		.then((notification) => {
			if (action == "yes") {
				Event.findById(notification.eventID)
					.lean()
					.then((event) => {
						let volunteers = event.volunteers;
						volunteers.push(notification.from);
						Event.findByIdAndUpdate(notification.eventID, {
							volunteers,
						})
							.then(() => {
								let newNotification = new Notification({
									to: notification.from,
									from: notification.to,
									message: `Hi, ${req.user.email} has accepted your volunteering request. You are now a volunteer for Event with event ID ${notification.eventID}`,
									eventID: notification.eventID,
									type: "VOLUNTEERING_RESPONSE",
									seen: false,
								});

								newNotification
									.save()
									.then((_) => {
										res.send({
											status: true,
											msg:
												"You have accepted this volunteering request",
											appearance: "success",
										});
									})
									.catch((err) => {
										res.send({
											status: false,
											msg: UNEXPECTED_ERROR,
											appearance: "error",
											err,
										});
									});
							})
							.catch((err) => {
								res.send({
									status: false,
									msg: UNEXPECTED_ERROR,
									appearance: "error",
									err,
								});
							});
					})
					.catch((err) => {
						res.send({
							status: false,
							msg: UNEXPECTED_ERROR,
							appearance: "error",
							err,
						});
					});
			} else {
				let newNotification = new Notification({
					to: notification.from,
					from: notification.to,
					message: `Hi, ${req.user.email} has denied your volunteering request for Event with event ID ${notification.eventID}`,
					eventID: notification.eventID,
					type: "VOLUNTEERING_RESPONSE",
					seen: false,
				});

				newNotification
					.save()
					.then((_) => {
						res.send({
							status: true,
							msg: "You have denied this volunteering request",
							appearance: "error",
						});
					})
					.catch((err) => {
						res.send({
							status: false,
							msg: UNEXPECTED_ERROR,
							appearance: "error",
							err,
						});
					});
			}
		})
		.catch((err) => {
			res.send({
				status: false,
				msg: UNEXPECTED_ERROR,
				appearance: "error",
				err,
			});
		});
});

/*
This route removes a volunteer from an event.
*/
router.post("/removeVolunteerFromEvent", (req, res) => {
	let { eventID } = req.body;
	Event.findById(eventID)
		.lean()
		.then((event) => {
			let volunteers = event.volunteers.filter(
				(volunteer) => volunteer != req.user.email
			);
			Event.findByIdAndUpdate(eventID, {
				volunteers,
			})
				.then((_) => {
					res.send({
						status: true,
						msg: "You are no longer a volunteer for this event",
						appearance: "error",
					});
				})
				.catch((err) => {
					res.send({
						status: false,
						msg: UNEXPECTED_ERROR,
						appearance: "error",
						err,
					});
				});
		})
		.catch((err) => {
			res.send({
				status: false,
				msg: UNEXPECTED_ERROR,
				appearance: "error",
				err,
			});
		});
});

/*
This route fetches volunteer emails in Add/Update Event forms which are then populated in
the volunteers field when clicked on any one of them.
*/
router.post("/fetchVolunteerEmails", (req, res) => {
	let { substring } = req.body;

	User.find({ role: "volunteer", email: new RegExp(substring, "i") }, "email")
		.then((users) => {
			res.send({
				status: true,
				emails: users
					.map((user) => user.email)
					.map((option) => ({ value: option, label: option })),
			});
		})
		.catch((err) => {
			res.send({
				status: false,
				msg: UNEXPECTED_ERROR,
				appearance: "error",
				err,
			});
		});
});

module.exports = router;
