//
// This is main file containing code implementing the Express server and functionality for the Express echo bot.
//
'use strict';
const ObjectId = require('mongodb').ObjectID;
const schedule = require('node-schedule');
const watson = require('watson-developer-cloud');
const mongodb = require("mongodb")
const express = require('express');
const bodyParser = require('body-parser');
const request = require('request');
const path = require('path');
import {getSortedList, incrementCounter, replaceCounter, flipCreating, 
        addDB, getDB, changeReminder, getProperty, getList} from './dbUtil';
import {nextReminder, checkDate, containsObject, list, getLocation} from './Util.js';
var http = require('https');
var fs = require('fs');

var messengerButton = "<html><head><title>Facebook Messenger Bot</title></head><body><h1>Facebook Messenger Bot</h1>This is a bot based on Messenger Platform QuickStart. For more details, see their <a href=\"https://developers.facebook.com/docs/messenger-platform/guides/quick-start\">docs</a>.<footer id=\"gWidget\"></footer><script src=\"https://widget.glitch.me/widget.min.js\"></script></body></html>";
//User's data
var userName = "test";
// Watson data
var conversation = watson.conversation({
  username: 'a162acb8-d510-4c1e-8e81-aa514ee3b769',
  password: 'kWC4xmdWiQ8Z',
  version: 'v1',
  version_date: '2017-02-03'
});
var context = {};
// The rest of the code implements the routes for our Express server.
let app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: true
}));
// database config
var MongoClient = mongodb.MongoClient
var url1 = "mongodb://tienanh2007:Dien1234@ds157040.mlab.com:57040/reminderbot";
// Webhook validation
app.get('/webhook', function(req, res) {
  if (req.query['hub.mode'] === 'subscribe' &&
      req.query['hub.verify_token'] === process.env.VERIFY_TOKEN) {
    console.log("Validating webhook");
    res.status(200).send(req.query['hub.challenge']);
  } else {
    console.error("Failed validation. Make sure the validation tokens match.");
    res.sendStatus(403);          
  }
});

// Display the web page
app.get('/', function(req, res) {
  res.writeHead(200, {'Content-Type': 'text/html'});
  res.write(messengerButton);
  res.end();
});

// Message processing
app.post('/webhook', function (req, res) {
  var data = req.body;
  if (data.object === 'page') {    
    // Iterate over each entry - there may be multiple if batched
    data.entry.forEach(function(entry) {
      var pageID = entry.id;
      var timeOfEvent = entry.time;
      // Iterate over each messaging event
      entry.messaging.forEach(function(event) {
        callUserProfileAPI(event.sender.id, function(body){
          var userData = {userid: event.sender.id, counter: 0, keywords: [], creating: false, reminder: {}, timezone: body.timezone};
          getDB("User", function(collection){
            if(!containsObject(event.sender.id, collection)){
              addDB("User", userData, event.sender.id);              
            }
            if (event.message) {
              receivedMessage(event); 
            } else if (event.postback) {
              receivedPostback(event); 
            } else {
              console.log("Webhook received unknown event: ", event);
            }
          });
        });
        
      });
    });

    // Assume all went well.
    //
    // You must send back a 200, within 20 seconds, to let us know
    // you've successfully received the callback. Otherwise, the request
    // will time out and we will keep trying to resend.
    res.sendStatus(200);
  }
});

function receivedMessage(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfMessage = event.timestamp;
  var message = event.message;

  console.log("Received message for user %d and page %d at %d with message:", 
    senderID, recipientID, timeOfMessage);

  var messageId = message.mid;

  var messageText = message.text;
  var messageAttachments = message.attachments;
  
  if (messageText) {
    getProperty(senderID, "User", "creating", function(p){
      if(p) newReminder(senderID, messageText);
      else{
        switch (messageText) {
          //Cases where the text doesn't have to go through BlueMix API (Nothing right now)
          // case 'generic':
          //   sendGenericMessage(senderID);
          //   break;
          default:
            sendTextMessage(senderID, messageText);
        }
      }
    });
  }
  if (messageAttachments) {
      getProperty(senderID, "User", "creating", function(p){
        if(p) newReminder(senderID, messageAttachments);
        else getAttachment(senderID, messageAttachments[0].payload.url, messageAttachments[0].type,"Attachment");
      })      
  }
}

function receivedPostback(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfPostback = event.timestamp;

  // The 'payload' param is a developer-defined field which is set in a postback 
  // button for Structured Messages. 
  var payload = event.postback.payload;

  console.log("Received postback for user %d and page %d with payload '%s' " + 
    "at %d", senderID, recipientID, payload, timeOfPostback);

  // When a postback is called, we'll send a message back to the sender to 
  // let them know it was successful
  
  //Do Something after users clicked Get Started button 
  if(event.postback.payload === "GET_STARTED_PAYLOAD"){
    callUserProfileAPI(senderID, function(body){
      console.log(body);
      var name = body.fist_name + " " + body.fist_name;
      sendWelcomeMessage(senderID, userName);
    })
    
  }
  else{
    getProperty(senderID, "User", "reminder", function(reminder){
      console.log(reminder);
      reminder.location = payload;
      var data = JSON.parse(payload);
      //console.log(payload);
      var messageData = {
        recipient: {
          id: senderID
        },
        message: {
          text: "Attach any files. Type skip if none"
        }
      };
      changeReminder(senderID, reminder);
      incrementCounter(senderID);
      callSendAPI(messageData);
    });
  }
}

//////////////////////////
// Sending helpers
//////////////////////////
function sendTextMessage(senderID, messageText) {
  conversation.message({
    workspace_id: '1e7573f5-939d-47e3-8690-5ef1c0946b63',
    input: {'text': messageText},
    context: context
  },  function(err, response) {
    if (err)
      console.log('error:', err);
    else{
      
      var messageData;
      if(response.intents[0]){
        var command = response.intents[0].intent;
        var respond = "";
        switch (command) {
        case 'list':
          list(senderID, function(str){
            callSendAPI({
              recipient: {
                id: senderID
              },
              message: {
                text: str
              }
            });
          });
        break;
        case 'next':
          nextReminder(senderID, function(str){
            var options = { weekday: "long", year: "numeric", month: "short",  
              day: "numeric" };  
            callSendAPI({
              recipient: {
                id: senderID
              },
              message: {
                text: "Here is something you need to do: " + str.content + " after " + str.date.toLocaleTimeString("en-US", options)
              }
            });
          });
        break;
        case 'create':
          respond = "What do you want to remind about?";
          flipCreating(true, senderID);
        break;
        case 'help':                      
          sendHelpMessage(senderID);          
        break;
        case 'delete':
            getSortedList(senderID, "Reminder", function(list){
              var index = Number(messageText.substr(messageText.length-1, 1))-1;
              if(index >= 0 && index < list.length){
                var id = list[index]._id;
                MongoClient.connect(url1, function (err, db) {
                  if (err) throw err
                  var collection = db.collection("Reminder");
                  collection.remove({"_id": ObjectId(id)}, function(err, doc){
                    callSendAPI({
                      recipient: {
                        id: senderID
                      },
                      message: {
                        text: "deleted " + list[index].content
                      }
                    });
                  });
                });
              }
            });
        break;
          case 'hi':
            respond = "Hello";
            break;
          case 'thx':
            respond = "You're welcome";
            break;
          case 'bye':
            respond = "Good bye!";
            break;
          case 'who':
            respond = "My name is Bob";
            break;
        default:
          respond = command;
        };
        messageData = {
          recipient: {
            id: senderID
          },
          message: {
            text: respond
          }
        }
      }
      else{
        var funnyQuotes = ['"How do you get a sweet little 80-year-old lady to say the F word? Get another sweet little 80-year-old lady to yell "BINGO!" - Anonymous',
                          'Knowledge is knowing a tomato is a fruit; wisdom is not putting it in a fruit salad. - Miles Kington',
                          'By all means, marry. If you get a good wife, you’ll become happy; if you get a bad one, you’ll become a philosopher. - Socrates',
                          'The best way to lie is to tell the truth . . . carefully edited truth. - Anonymous',
                          'If you steal from one author, it’s plagiarism; if you steal from many, it’s research. - Wilson Mizner',
                          'If evolution really works, how come mothers only have two hands? - Milton Berle'];
        var i = Math.floor(Math.random()*6);
        messageData = {
          recipient: {
            id: senderID
          },
          message: {
            text: funnyQuotes[i] + "\nSorry for not understanding you. But above is a funny quote"
          }
        }
      }
      if(messageData.message.text) callSendAPI(messageData);
    }
  });
}

function sendWelcomeMessage(senderId, name) {
  var messageData = {
    recipient: {
      id: senderId
    },
    message: {
      text: "Welcome aboard " + name + "! My name is Bob. Right now I'm gonna walk you through the basic steps.\n" +
      "To talk to me, you don't have to say exact commands everytime. For example:\n" + 
      "- Set up new reminders: 'I want to make/create/have new reminder'\n" + 
      "- Retrieve the next reminder: 'I want to see the next/upcoming/following reminder'\n" + 
      "- Retrieve the list of reminders: 'I want to list/show/get all reminders'\nand many more..."
    }
  };

  callSendAPI(messageData);
}

//Send the message when the user use 'help' command
function sendHelpMessage(senderId) {
  var messageData = {
    recipient: {
      id: senderId
    },
    message: {
      text: "- Set up new reminders: 'I want to make/create/have new reminder'\n" + 
      "- Retrieve the next reminder: 'I want to see the next/upcoming/following reminder'\n" + 
      "- Retrieve the list of reminders: 'I want to list/show/get all reminders'\n" + 
      "- Delete a reminder: 'I want to remove/delete/destroy' [index] (index is the index number of the reminder in the list of reminders)\n" +
      "- Help: 'help/instruction/command'"
    }
  };

  callSendAPI(messageData);
}


function getAttachment(senderID, url, fileType, message){
  url = url.replace(/&/g, '%26');
  var urlReq = "https://project1-minhtri1296.c9users.io/test?url="+url+"&type="+fileType+"&userid="+senderID;
  console.log(urlReq);
  request({
    uri: urlReq,
    method: 'GET'
  }, function(error, response, body) {
      console.log("DONE!");
  })
}

function countAttachment(senderID){
  MongoClient.connect(url1, function (err, db) {
    if (err) throw err
    var collection = db.collection("Attachments");
    collection.find({"userid": senderID}).count(function(err, result){
      console.log(count);
      var count = result;
    });
  })
}

function callSendAPI(messageData) {
  request({
    uri: 'https://graph.facebook.com/v2.6/me/messages',
    qs: { access_token: process.env.PAGE_ACCESS_TOKEN },
    method: 'POST',
    json: messageData

  }, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var recipientId = body.recipient_id;
      var messageId = body.message_id;

      //console.log("Successfully sent generic message with id %s to recipient %s", messageId, recipientId);
    } else {
      console.error("Unable to send message.");
      console.error(response);
      console.error(error);
    }
  });  
}


//Get the User Profile API
function callUserProfileAPI(senderID, cb){
  request({
    uri: 'https://graph.facebook.com/v2.6/' + senderID + '?fields=first_name,last_name,timezone&access_token=' + process.env.PAGE_ACCESS_TOKEN,
    method: 'GET'
  }, function(error, response, body) {
    if (!error && response.statusCode == 200) {
      body = JSON.parse(body);
      userName = body.first_name + " " + body.last_name;
      console.log("Successfully sent generic message with the name " + body.first_name + " " + body.last_name);
      if(cb) cb(body);
    } else {
      console.error("Unable to send message.");
      //console.error(response);
      //console.error(error);
    }
  });
}


function newReminder(senderID, messData){
  var respondText;
  getProperty(senderID, "User", "counter", function(counter){
    getProperty(senderID, "User", "reminder", function(reminder){
      getProperty(senderID, "User", "timezone", function(timezone){
        console.log(counter);
        if (counter == 0){
          reminder.userid = senderID;
          reminder.content = messData;
          incrementCounter(senderID);
          respondText = {
                          text: "When? (mm/dd/yy-hh:mm)"
                        };
        }
        else if (counter == 1){
          var parts =  messData;
          reminder.date = new Date(20+parts.substr(6,2),Number(parts.substr(0,2))-1,parts.substr(3,2), Number(parts.substr(9,2)),parts.substr(12,2));
          var text = checkDate(reminder.date, parts, timezone);
          if (text == "Do you want add more information? (Y for yes, N for No)") incrementCounter(senderID);
          respondText = {
                          text: text
                        };
        }
        else if(counter == 2){
          if(messData !== "Y" && messData !== "N"){
            respondText = {
                          text: "Invalid character, type again (Y/N)."
                        };
          }
          else if(messData == "N"){
            flipCreating(false, senderID);
            reminder.date.setHours(reminder.date.getHours()-timezone);
            addDB("Reminder", reminder, senderID, function(doc){
              var doc = doc.ops[0];
              schedule.scheduleJob(doc.date, function(x){
                MongoClient.connect(url1, function (err, db) {
                  if (err) throw err
                  var collection = db.collection("Reminder");
                  collection.find({"_id": ObjectId(doc._id)}).toArray(function(err, docs){
                    if (err) throw err
                    if(docs.length != 0){
                      callSendAPI({
                        recipient: {
                          id: senderID
                        },
                        message: {
                          text: "Here is something you need to do: " + x.content
                        }
                      });
                      collection.remove({"_id": ObjectId(doc._id)});
                      db.close();
                    }
                  });
                });
              }.bind(null, doc));
            });
            respondText = {
              text: "Event added successfully!"
            };            
            replaceCounter(0 ,senderID);
            reminder = {};
          }
          else{
            respondText = {
                          text: "What is the location? Type skip if none"
                        };  
            incrementCounter(senderID);
          }
        }
        else if(counter == 3){
          if(messData != "skip") {
            //reminder.location = messageText;
            var places = getLocation(messData);
            var long, lat;
            var buttons = [];
            for(var i=0; i<Math.min(3, places.length); i++){
              var button = {type:"postback",
                            title:places[i]['name'],
                            payload: JSON.stringify(places[i])}
              buttons.push(button);
            }

            respondText = {
              attachment:{
                type:"template",
                payload:{
                  template_type:"button",
                  text:"Choose a location: ",
                  buttons: buttons
                }
              }
            };  
            //respondText.attachment.payload.buttons = buttons;

            console.log(buttons);
            callSendAPI({
                      recipient: {
                        id: senderID
                      },
                      "message":respondText
                        
          })
            // console.log(typeof respondText.attachment.payload.buttons);
            // console.log(respondText.attachment.payload.buttons);
            // console.log(respondText);
          }
          else{
          respondText = {
                          text: "Attach any files. Type skip of none"
                        };  
            incrementCounter(senderID);
          }
          
          
          //respondText = "Attach any files. Type skip of none";
          return;
        }
        else if (counter == 4){
          console.log(reminder);
          reminder.attachment = {url: "", type: ""}
          if (messData[0].type){
            getAttachment(senderID, messData[0].payload.url, messData[0].type, "Attachment");
            //Later will check for total element in database files
            reminder.attachment = {url: "https://preview.c9users.io/minhtri1296/project1/file-upload/test.png", type: messData[0].type};
          }
                    
          //addDB("Reminder", reminder, senderID);
          respondText = {
                          text: "Finshed creating reminder."
                        };            
          flipCreating(false, senderID);
          replaceCounter(0,senderID);
          console.log("Success!");
          console.log(reminder);
          reminder.date.setHours(reminder.date.getHours()-timezone);
          addDB("Reminder", reminder, senderID, function(doc){
            var doc = doc.ops[0];
            schedule.scheduleJob(reminder.date, function(x){
              MongoClient.connect(url1, function (err, db) {
                if (err) throw err
                var collection = db.collection("Reminder");
                collection.find({"_id": ObjectId(doc._id)}).toArray(function(err, docs){
                  if (err) throw err
                  if(docs.length != 0){
                    if (reminder.attachment){  
                      callSendAPI({
                        recipient: {
                          id: senderID
                        },
                        "message":{
                          "attachment":{
                            "type": reminder.attachment.type,
                            "payload":{
                              "url": reminder.attachment.url
                            }
                          }
                        }
                      })
                    }                    
                    if(reminder.location){
                      var location = JSON.parse(reminder.location);
                      console.log(location);
                      callSendAPI({
                        recipient: {
                          id: senderID
                        },
                        message: {
                          "attachment":{
                            "type":"template",
                            "payload":{
                              "template_type":"generic",
                              "elements":[
                                 {
                                  "title": location.name,
                                   "image_url":"https://maps.googleapis.com/maps/api/staticmap?center="+location.latitude+","+location.longitude+"&zoom=15&size=600x300&maptype=roadmap&markers=color:red|"+location.latitude+","+location.longitude,
                                  "subtitle": "Here is something you need to do at this location: \"" + reminder.content + "\"",
                                  "buttons":[
                                    {
                                      "type":"web_url",
                                      "url":"https://www.google.com/maps/place/"+location.name+"/@"+location.latitude+","+location.longitude,
                                      "title":"go to Google Map"
                                    }
                                  ]      
                                }
                              ]
                            }
                          }
                        }
                      });
                      collection.remove({"_id": ObjectId(doc._id)});
                      db.close();
                    }
                    else{
                      callSendAPI({
                        recipient: {
                          id: senderID
                        },
                        message: {
                          text: "Here is something you need to do: " + reminder.content
                        }
                      });
                      collection.remove({"_id": ObjectId(doc._id)});
                      db.close();
                    }
                  }
                });
              });
            }.bind(null, doc));
          });
        }
        var messageData = {
          recipient: {
            id: senderID
          },
          message: respondText
        };
        console.log("test");
        callSendAPI(messageData);
        console.log(counter);
        changeReminder(senderID, reminder);
      });
    });
  });
}


// Set Express to listen out for HTTP requests
var server = app.listen(process.env.PORT || 3000, function () {
  console.log("Listening on port %s", server.address().port);
});
