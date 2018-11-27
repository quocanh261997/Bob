import {getList, getProperty, getSortedList} from './dbUtil';
const sRequest = require('sync-request');
exports.nextReminder = function(senderID, cb){
  getList(senderID, "Reminder", function(list){
    if(list[0]){
      cb(list[0]);
    } 
    else cb("No Reminder");
  });
}
exports.list = function(senderID, cb){
  getProperty(senderID, "User", "timezone", function(timezone){
    getSortedList(senderID, "Reminder", function(list){
      var i = 1;
      var str = "";
      list.forEach(function(reminder){
        var day = reminder.date.getDate();
        var month = reminder.date.getMonth() + 1;
        var year = reminder.date.getFullYear();
        var hour = reminder.date.getHours()+timezone;
        var minute = reminder.date.getMinutes();
        str += i + ". Content: " + reminder.content + "\n   Date: " + month + "/" + day + "/" + year 
          + " " + hour + ":" + minute + "\n   Location: " + (reminder.location !== undefined ? JSON.parse(reminder.location).name : "none")+ "\n";
        i++;
      });
      if(!str) str = "No reminders";
      cb(str);
    });
  });
}
exports.containsObject = function(id, list) {
    var i;
    for (i = 0; i < list.length; i++) {
        if (list[i].userid == id) {
            return true;
        }
    }

    return false;
}


exports.checkDate = function(testDate, parts, timezone){
  var curDate = new Date();
  testDate.setHours(testDate.getHours()-timezone);
  var year = Number(20+parts.substr(6,2));
  var month = Number(parts.substr(0,2))-1;
  var date = Number(parts.substr(3,2));
  var hour = Number(parts.substr(9,2));
  var minute = Number(parts.substr(12,2));
  if (curDate.getTime()>testDate.getTime()) return "Invalid date! Please insert time in the future for your reminder";
  testDate.setHours(testDate.getHours()+timezone);
  if (year!=testDate.getFullYear()||month!=testDate.getMonth()||date!=testDate.getDate()||hour!=testDate.getHours()||minute!=testDate.getMinutes()){
  return "Invalid date format! Please type again!";
  }
  return "Do you want add more information? (Y for yes, N for No)";
}
exports.getLocation = function(location){
  var places = [];
  var url = "https://maps.googleapis.com/maps/api/place/textsearch/json?query=" + location + "&key=" + process.env.GOOGLE_API_KEY;
  var res = sRequest('GET', url, {
            timeout: 10000  
        });
  var data =  JSON.parse(res.getBody('utf8'));
  
  for (var i = 0; i < data.results.length; i++){
    var place = {"name": data.results[i]["formatted_address"], 
                "latitude": data.results[i]["geometry"]["location"]["lat"],
                "longitude": data.results[i]["geometry"]["location"]["lng"]
                };
    //var messageId = body.message_id;
    places.push(place);
    //console.log("Successfully sent generic message with place "+ place.name + " longitude = " + place.longitude);
  }  
  return places;
}