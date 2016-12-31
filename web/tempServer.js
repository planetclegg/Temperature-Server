var express = require('express'),
    csv2 = require('csv2'),
    streams = require('stream'),
    path = require('path'),
    Transform = streams.Transform,
    Writable = streams.Writable,
    application_root = __dirname,
    app = express(),
    port = parseInt(process.env.PORT, 10) || 8000;    // defaults to port 8000   


var config = require('./config'); // read config file.
var currentReadings = { }; // will hold readings as they come in..

var maxHistoryHours = 24*7;  // keep 7 days of readings in memory since last "current" reading
var history = {
    name: "graph data",
    description: "this would be polled every minute. intervalLength would be seconds per reading",
    downloadTime: 123123,
    readings: { 
      // example:
      // "99": {
      //   name: "porch",
      //   ...
      //   samples: [ [123123,33,44], [123123,33,44] ]
      //}
    } 
}

app.configure(function(){
  app.use(express.compress());  // save bandwidth
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.directory(path.join(application_root, 'public')));  /////REMOVE
  app.use(express.static(path.join(application_root, 'public')));
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
  app.set('json spaces', 0); // save bandwidth
  //app.disable('etag');  // thought this would fix 304s, but not really.
});


//req.query is ONLY the GET params. get the POST data from req.body.  eq.params() gets both
app.get('/',            function(req, res)  { res.sendfile(path.join(application_root, 'public/index.html')); });
app.get('/api',         function(req, res)  { res.send('Hello World! Weather Api is working');  });
app.get('/api/error',   function(req, res)  { throw "Here's an error";  });
app.get('/api/myip',    function(req, res)  { res.send( { clientIp: getClientIp(req) } ); });
//app.get('/api/temp/:id?', function(req,res) { res.send("TODO:" +req.params.id) });
app.get('/api/temps',   function(req,res)   { 
  var list = [];
  for (var id in currentReadings) {
    list.unshift(currentReadings[id]);
  }
  list.sort(function(a,b) { return a.idNum - b.idNum});

  var result = {
      name: "current",
      downloadTime: new Date().getTime(),
      readings: list
  }
  res.send(result) 
});

app.get('/api/temps/history',   function(req,res)   { 
  res.send(history);
});


app.listen(port);

console.log('Listening on port %d', port);

// parse the input line into javascript object
var parser = new Transform({objectMode: true});
parser._transform = function(data, encoding, done) {
//    console.log(data);
    var json = parseLine(data);
    if (json) this.push(json);
    done();
};

// consumer:  get js objects and set the appropriate curent reading.
var readingConsumer = Writable({objectMode: true});
readingConsumer._write = function (reading, enc, next) {
    currentReadings[reading.id] = reading;
    saveHistory(reading);
    //console.log( reading);
    next();
    // todo: update historical readings....
//    console.log(currentReadings);
};


// take input from stdin
var rx = process.stdin

// process it...
rx
  .pipe(csv2())
  .pipe(parser)
  .pipe(readingConsumer);





// parse one line... takes the output of csv2, generates an object
function parseLine(data) {
  try {
    //## note: now expects timestamp as first item...
    var id = /Id:(.*)/.exec(data[3])[1];   // extract full id, e.g. "f3/4"
    var idNum = parseInt(/\/(.*)/.exec(id)[1]); // extract just the device number, e.g. "4"
    var timeStr = data[0];

    var name = config.idsToNames[idNum] || "unknown"

    var result = {
        id: id,
        idNum: idNum,
        name: name,
        description: name,
        status: "todo",
        current: {
          type: "current",
          packetNum: parseInt(data[1]),
          //readingTime: timestamp(),
          readingTime: parseTimeStamp(timeStr),
          temp: parseFloat(/Temp:(.*)/.exec(data[4])[1]),
          humidity: parseInt(/Hum:(.*)/.exec(data[5])[1]),
          batteryOk: /Batt:(.*)/.exec(data[2])[1] == 'ok'
        }
    };
    //console.log(result);
    return result;
  }
  catch (err) {
    console.log("bad packet: "+data +" "+ err)
    return null;
  }
}


// given a reading, saves it to the history collection
function saveHistory(reading) {
    var id = reading.id;
    var current = reading.current;
    var existing = history.readings[reading.idNum];    
    if (!existing)
    {
      // this is the first time we've seen this id...
      existing = {
          id: id,
          idNum: reading.idNum,
          name: reading.name,
          description: reading.description,
          intervalTime: 60,
          startTime: current.readingTime,
          endTime: current.readingTime,
          samples: [], 
      };
      history.readings[reading.idNum] = existing;
    }

    flushOldHistory(existing.samples, current.readingTime);
  
    existing.samples.push([current.readingTime, current.temp, current.humidity]);    
    existing.endTime = current.readingTime;
}

// removes old samples so memory usage doesn't expand infinitely
function flushOldHistory(samples, currentTime) {
    var historyCutoff = currentTime - (maxHistoryHours * 60 *60 *1000);
    while (samples.length > 0 && samples[0][0] < historyCutoff)
      samples.shift();
}


// parse a timestamp in this format:  "2016-08-15 19.48.25".. 
function parseTimeStamp(s) {
  var a = s.split(/[- .]/);
  // timestamp is UTC, convert to local...
  return  Date.UTC(a[0], a[1]-1, a[2], a[3], a[4],a[5]); // Note: months are 0-based
}

function getClientIp(req) {
    return req.connection.remoteAddress;  // for proxies: //ip_address = req.headers['x-forwarded-for'];
}


