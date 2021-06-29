let router = require("express").Router();
let User = require("../Models/User");
let Event = require("../Models/Event");
let Notification = require("../Models/Notification");
let bcrypt = require("bcryptjs");
let multer = require("multer");

var storage = multer.diskStorage({
	destination: function (req, file, cb) {
		cb(null, "./public/eventImages");
	},
	filename: function (req, file, cb) {
		let [filename, ext] = file.originalname.split(".");
		req.filename = `${req.user.email}-${filename}-${Date.now()}.${ext}`;
		cb(null, req.filename);
	},
});

var upload = multer({ storage: storage });

let isEmpty = (value) => {
	let emptyValues = [null, undefined, ""];
	return emptyValues.includes(value);
};

const UNEXPECTED_ERROR = "Sorry, Something occured unexpectedly";

router.post("/createEvent", upload.any(), (req, res) => {
	let {
		name,
		zipcode,
		description,
		start,
		end,
		numberOfVolunteersRequired,
		volunteers
	} = req.body;
	let newEvent = new Event({
		name,
		zipcode,
		start: new Date(start),
		end: new Date(end),
		description,
		numberOfVolunteersRequired,
		image: req.filename,
		organizer: req.user.email,
		volunteers:JSON.parse(volunteers).map(volunteer=>volunteer.value)
	});
	newEvent
		.save()
		.then(() => {
			res.send({
				status: true,
				msg: "New event has been added",
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
});

router.post("/updateEvent", upload.any(), (req, res) => {
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
	let updatedEvent = {
		name,
		zipcode,
		description,
		start: new Date(start),
		end: new Date(end),
		numberOfVolunteersRequired,
		image: req.filename || image,
		volunteers:JSON.parse(volunteers).map(volunteer=>volunteer.value),
	};
	Event.findByIdAndUpdate(id, updatedEvent, { new: true })
		.lean()
		.then((updateEventObj) => {
			res.send({
				status: true,
				msg: "Event has been updated",
				appearance: "success",
				body: req.body,
				updatedEvent,
				updateEventObj,
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

router.post("/event", (req, res) => {
	let { id } = req.body;
	Event.findById(id)
		.lean()
		.then((event) => {
			let startDate = new Date(event.start);
			let endDate = new Date(event.end);
			res.send({
				status: true,
				event: {
					...event,
					start: `${startDate.getFullYear()}-${`${startDate.getMonth()}`.padStart(
						2,
						"0"
					)}-${startDate.getDate()}`,
					end: `${endDate.getFullYear()}-${`${startDate.getMonth()}`.padStart(
						2,
						"0"
					)}-${endDate.getDate()}`,
					volunteers:event.volunteers.map((option) => ({ value: option, label: option }))
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

router.get("/events", (req, res) => {
	Event.find(
		req.user.role == "charity"
			? { organizer: { $ne: req.user.email } }
			: { volunteers: { $ne: req.user.email } }
	)
		.lean()
		.sort({ createdAt: -1 })
		.then((events) => {
			console.log(events);
			res.send({
				status: true,
				events: events.map((event) => {
					let startDate = new Date(event.start);
					let endDate = new Date(event.end);
					return {
						...event,
						start: `${startDate.getDate()}/${startDate.getMonth()}/${startDate.getFullYear()}`,
						end: `${endDate.getDate()}/${endDate.getMonth()}/${endDate.getFullYear()}`,
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

router.get("/myEvents", (req, res) => {
	Event.find(
		req.user.role == "charity"
			? { organizer: req.user.email }
			: { volunteers: req.user.email }
	)
		.lean()
		.sort({ createdAt: -1 })
		.then((events) => {
			res.send({
				status: true,
				events: events.map((event) => {
					let startDate = new Date(event.start);
					let endDate = new Date(event.end);
					return {
						...event,
						start: `${startDate.getDate()}/${startDate.getMonth()}/${startDate.getFullYear()}`,
						end: `${endDate.getDate()}/${endDate.getMonth()}/${endDate.getFullYear()}`,
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

router.post("/deleteEvent", (req, res) => {
	let { id } = req.body;

	Event.findByIdAndDelete(id)
		.then((_) => {
			res.send({
				status: true,
				msg: "Item Deleted",
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

router.post("/searchEvents", (req, res) => {
	let { name, zipcode, volunteers, start, end } = req.body;

	let eventToFind = {
		name: isEmpty(name) ? "" : new RegExp(name, "i"),
		zipcode,
		volunteers,
		start: isEmpty(start) ? "" : { $lt: start },
		end: isEmpty(end) ? "" : { $gt: end },
		...(req.user.role == "charity"
			? { organizer: { $ne: req.user.email } }
			: { volunteers: { $ne: req.user.email } }),
	};
	console.log("before", eventToFind);

	Object.keys(eventToFind).forEach(
		(key) => isEmpty(eventToFind[key]) && delete eventToFind[key]
	);

	console.log("after", eventToFind);

	Event.find(eventToFind)
		.sort({ createdAt: -1 })
		.lean()
		.then((events) => {
			res.send({
				status: true,
				eventToFind,
				events: events.map((event) => {
					let startDate = new Date(event.start);
					let endDate = new Date(event.end);
					return {
						...event,
						start: `${startDate.getDate()}/${startDate.getMonth()}/${startDate.getFullYear()}`,
						end: `${endDate.getDate()}/${endDate.getMonth()}/${endDate.getFullYear()}`,
					};
				}),
				body: req.body,
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
