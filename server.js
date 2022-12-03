import express from 'express';
import dotenv from 'dotenv';
import request from 'request';
import morgan from 'morgan';

const app = express();

// init to make .env variables available in this file(server.js)
dotenv.config();

//Middleware
app.use(express.json());
app.use(morgan('dev'));

// Parse application/x-www-form-urlencoded
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 5000;

app.get('/', function (_req, res) {
	res.send(
		'<h1 style="padding: 20px; text-align: center">Facebook Messenger chatbot server running!!!!!!! </h1>'
	);
});

// Adds support for GET requests to our webhook
//FB will send request here to verify your webhook.
app.get('/webhook', (req, res) => {
	// Your verify token. Should be a any random string.
	const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

	// Parse the query params
	let mode = req.query['hub.mode'];
	let token = req.query['hub.verify_token'];
	let challenge = req.query['hub.challenge'];

	// Checks if a token and mode is in the query string of the request
	if (mode && token) {
		// Checks the mode and token sent is correct
		if (mode === 'subscribe' && token === VERIFY_TOKEN) {
			// Responds with the challenge token from the request
			console.log('WEBHOOK_VERIFIED');
			res.status(200).send(challenge);
		} else {
			// Responds with '403 Forbidden' if verify tokens do not match
			res.sendStatus(403);
		}
	}
});

// Sends response messages via the Send API
function callSendAPI(senderPsid, response) {
	// The page access token we have generated in your app settings
	const PAGE_ACCESS_TOKEN = process.env.ACCESS_TOKEN;

	// Construct the message body
	let requestBody = {
		recipient: {
			id: senderPsid,
		},
		message: response,
	};

	request(
		{
			uri: 'https://graph.facebook.com/v15.0/me/messages',
			qs: { access_token: PAGE_ACCESS_TOKEN },
			method: 'POST',
			json: requestBody,
		},
		(err, _res, _body) => {
			if (!err) {
				console.log('Message sent!');
			} else {
				console.error('Unable to send message:' + err);
			}
		}
	);
}

// Handle incoming messages
function handleMessage(sender_psid, received_message, webhookEvent) {
	let response;

	// Checks if the message contains text
	if (received_message.text) {
		// Create the payload for a basic text message, which
		// will be added to the body of our request to the Send API
		response = {
			text: `HiThere!!!!, send screenshot of your VS Code to help fix the bug.`,
		};
		console.log('IM RESPONDING NORMAL TEXT TO => ', sender_psid);
		console.log('======================');
		console.log('Webhook event => ', webhookEvent);
		// Send the response message
		callSendAPI(sender_psid, response);
	} else if (received_message.attachments) {
		// Get the URL of the message attachment
		let attachment_url = received_message.attachments[0].payload.url;
		response = {
			attachment: {
				type: 'template',
				payload: {
					template_type: 'generic',
					elements: [
						{
							title: 'Is this the right screenshot of your code?',
							subtitle: 'Tap a button to answer.',
							image_url: attachment_url,
							buttons: [
								{
									type: 'postback',
									title: 'Yes!',
									payload: 'yes',
								},
								{
									type: 'postback',
									title: 'No!',
									payload: 'no',
								},
							],
						},
					],
				},
			},
		};
		console.log('IM RESPONDING ATTACHMENT MSG TO => ', sender_psid);
		// Send the response message
		callSendAPI(sender_psid, response);
	}
}

// Handles messaging_postbacks events(when click one of the buttons Yes or NO)
function handlePostback(senderPsid, receivedPostback) {
	let response;

	// Get the payload for the postback
	let payload = receivedPostback.payload;

	// Set the response based on the postback payload
	if (payload === 'yes') {
		response = { text: 'Okay, we will get back to you!' };
	} else if (payload === 'no') {
		response = { text: 'Oops, try sending the correct file.' };
	}
	// Send the message to acknowledge the postback
	callSendAPI(senderPsid, response);
}

// Received FB webhook post request
app.post('/webhook', (req, res) => {
	let body = req.body;
	console.log('Im Hook');

	// Checks if this is an event from a page subscription
	if (body.object === 'page') {
		// Iterates over each entry - there may be multiple if batched
		body.entry.forEach(function (entry) {
			// Gets the body of the webhook event
			let webhookEvent = entry.messaging[0];
			console.log(webhookEvent);

			// Get the sender PSID
			let senderPsid = webhookEvent.sender.id;
			console.log('Sender PSID: ' + senderPsid);

			// Check if the event is a message or postback and
			// pass the event to the appropriate handler function
			if (webhookEvent.message) {
				handleMessage(senderPsid, webhookEvent.message, webhookEvent);
			} else if (webhookEvent.postback) {
				handlePostback(senderPsid, webhookEvent.postback, webhookEvent);
			}
		});

		// Returns a '200 OK' response to all requests
		res.status(200).send('EVENT_RECEIVED');
	} else {
		// Returns a '404 Not Found' if event is not from a page subscription
		res.sendStatus(404);
	}
});

app.listen(PORT, () =>
	console.log(
		`Server running on port ${PORT} in ${process.env.NODE_ENV} mode...`
	)
);
