const mongodb = require("mongodb")
var MongoClient = mongodb.MongoClient
var url1 = "mongodb://tienanh2007:Dien1234@ds157040.mlab.com:57040/reminderbot";
exports.getSortedList = function(senderID, collectionName, cb){
  MongoClient.connect(url1, function (err, db) {
    if (err) throw err
    var collection = db.collection(collectionName);
    collection.find({"userid": senderID}, {"sort":["date"]}).toArray(function(err, docs){
      cb(docs);
    });
  })
}
exports.incrementCounter = function(senderID){
  MongoClient.connect(url1, function (err, db) {
    if (err) throw err
    var collection = db.collection("User");
    collection.findOneAndUpdate({"userid":senderID},{$inc:{"counter":1}});
  })
}
exports.replaceCounter = function(value, senderID){
  MongoClient.connect(url1, function (err, db) {
    if (err) throw err
    var collection = db.collection("User");
    collection.findOneAndUpdate({"userid":senderID},{$set:{"counter" : value}});
  })
}
exports.flipCreating = function(value, senderID){
  MongoClient.connect(url1, function (err, db) {
    if (err) throw err
    var collection = db.collection("User");
    collection.findOneAndUpdate({"userid":senderID},{$set:{"creating" : value}});
  })
}
//Function for database (#database)
exports.addDB = function(name, object, senderID, cb){
  MongoClient.connect(url1, function (err, db) {
    if (err) throw err
    var collection = db.collection(name);
    collection.insert(object, function(err, docs){
      if(err) console.log(err);
      if(cb) cb(docs);
      db.close();
    });
  })
}
exports.getDB = function(name, cb){
  MongoClient.connect(url1, function (err, db) {
    if (err) throw err
    var collection = db.collection(name);
    collection.find({},{_id:0}).toArray(function(err, docs) {
      db.close();
      cb(docs);
    })
  })
}
exports.changeReminder = function(senderID, value){
  MongoClient.connect(url1, function (err, db) {
    if (err) throw err
    var collection = db.collection("User");
    collection.findOneAndUpdate({"userid":senderID},{$set:{"reminder" : value}});
  })
}
exports.getProperty = function(senderID, collectionName, property, cb){
  MongoClient.connect(url1, function (err, db) {
    if (err) throw err
    var collection = db.collection(collectionName);
    collection.findOne({"userid": senderID}, function(err, ret){
      cb(ret[property]);
    });
  })
}
exports.getList = function(senderID, collectionName, cb){
  MongoClient.connect(url1, function (err, db) {
    if (err) throw err
    var collection = db.collection(collectionName);
    collection.find({"userid": senderID}).toArray(function(err, docs){
      cb(docs);
    });
  })
}