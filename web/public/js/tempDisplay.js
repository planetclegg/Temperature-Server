
if (typeof jQuery === 'undefined') { throw new Error('tempDisplay requires jQuery'); }
if (typeof ko === 'undefined') { throw new Error('tempDisplay requires knockout'); }

(function ($, ko) {

  function AppViewModel() {
    this.current =  ko.observable({ readings: [] });
  //    this.history =  ko.observableArray([]); // no longer used, now jamming into highstocks directly
  }

  var model = new AppViewModel();


   // on document load:
  $( document ).ready( function() {
    ko.applyBindings(model);   // setup knockout bindings

    setupChart();  // setup highstocks chart

    $("#refreshHighstock").on( "click", function() { 
      loadHistoryHighstock();
    } );


    loadTemps();
    setInterval( loadTemps, 10000); // every 10 seconds
    loadHistoryHighstock();
    setInterval(loadHistoryHighstock, 10 * 60 * 1000);  // every 10 minutes

  } );

  function loadTemps() {
    $.ajax({ url: '/api/temps', dataType:'json' })
      .done(function(result) {
        model.current(result);
      })
      .fail(function() { /* todo */ } );
  }

  function loadHistoryHighstock() { // new highcharts ways
    $.ajax({url:'/api/temps/history', dataType: 'json'})
      .done(function(result) {
        updateChartHighstock(result);
      })
      .fail(function() { /* todo */ });
  }


  function updateChartHighstock(data) {
    //console.log(data)
      var minTemp = 99999999999999;
      var maxTemp = -999999999999;  
      var minHumidity = 99999999999999;
      var maxHumidity = -999999999999;  
      for (var key in data.readings) {
        var reading = data.readings[key];
                //tempMaxRange = Math.max(sample[0], tempMaxRange);
          //tempMinRange = Math.min(sample[0], tempMinRange);
        var tempSamples = reading.samples.map(function(a) { 
          minTemp = Math.min(minTemp, a[1]);
          maxTemp = Math.max(maxTemp, a[1]);
          return [a[0],a[1]]; 
        });
        var humiditySamples = reading.samples.map(function(a) {
          minHumidity = Math.min(minHumidity, a[2]);
          maxHumidity = Math.max(maxHumidity, a[2]);
          return [a[0], a[2]];
        })
        
        var oldTemp = tempHighstock.series.filter(function(a) { return a.name == reading.name; });
        if (oldTemp.length)
        {
          oldTemp = oldTemp[0];   // Nth time, update old existing series
          oldTemp.setData(tempSamples);
        }
        else
        {
          tempHighstock.addSeries({   // first time, need to add the series
            name: reading.name,
            data: tempSamples,
          }, false);
        }

        var oldHumidity = humidityHighstock.series.filter(function(a) { return a.name == reading.name; });
        if (oldHumidity.length)
        {
          oldHumidity = oldHumidity[0];
          oldHumidity.setData(humiditySamples);
        }
        else
        {
          humidityHighstock.addSeries({
            name: reading.name,
            data: humiditySamples,
          }, false);
        }

      }

      // set chart extremes from processed data
      for (var q = 0; q < tempHighstock.yAxis.length; q++)
        tempHighstock.yAxis[q].setExtremes(minTemp,maxTemp);
      for (var q = 0; q <  humidityHighstock.yAxis.length; q++)
        humidityHighstock.yAxis[q].setExtremes(minHumidity,maxHumidity);
      //tempHighstock.yAxis[0].setExtremes(min,max);
      //tempHighstock.xAxis[1].setExtremes(min,max);
      tempHighstock.reflow();
      tempHighstock.redraw();
      humidityHighstock.reflow();
      humidityHighstock.redraw();
      //tempHighstock.xAxis[2].setExtremes();
      //tempHighstock.xAxis[3].setExtremes();
  }

 

  function setupChart() {

    Highcharts.setOptions({
        global : {
            useUTC : true
        },

        chart : {
          //renderTo: $('#temp-highstock')[0],
          panning: false,
          pinchType:"",
          events : {
            load : function () {
                // set up the updating of the chart each second
                // var series = this.series[0];
                // setInterval(function () {
                //     var x = (new Date()).getTime(), // current time
                //         y = Math.round(Math.random() * 100);
                //     series.addPoint([x, y], true, true);
                // }, 1000);
              }
          },
          backgroundColor: {
          linearGradient: { x1: 0, y1: 0, x2: 1, y2: 1 },
          stops: [
              [0, '#2a2a2b'],
              [1, '#3e3e40']
            ]
          },
        },

        credits: { enabled: false},
        rangeSelector: {
          buttons: [{
              count: 1,
              type: 'hour',
              text: '1hr'
          }, {
              count: 24,
              type: 'hour',
              text: '1d'
          },{
              count: 48,
              type: 'hour',
              text: '2d'
          },{
              count: 72,
              type: 'hour',
              text: '3d'
          }, {
              count: 96,
              type: 'hour',
              text: '4d'
          }, {
              count: 24*7,
              type: 'hour',
              text: '7d'
          },{
              type: 'all',
              text: 'All'
          }],
          inputEnabled: false,
          selected: 2
      },
      plotOptions: {
        line: {
            linecap: "square",
            //lineWidth: 5
        },
        series: {
          //type: 'spline',
          //type : 'candlestick',
          //marker : { enabled : true, radius : 3 },
          lineWidth:2,
          states: {
            hover: {
              lineWidth:2
            }
          },
        },
      },
      scrollbar: {
        //liveRedraw: true,
      },

      title : {
          text : 'Temp'
      },

      exporting: {
          enabled: false
      },
      tooltip: {
          valueDecimals: 1,//4,
          followPointer:true,
          followTouchMove:true,
          animation:false,
          //crosshairs: [true,true],
      },
      title: {
        style: {
           color: '#E0E0E3',
           textTransform: 'uppercase',
           fontSize: '20px'
        }
      },
      // yAxis: {
      //   min: 0,
      //   max: 100,
      // }



    });


  Highcharts.theme = {
     colors: ["#90ee7e", "#2b908f",  "#f45b5b", "#7798BF", "#aaeeee", "#ff0066", "#eeaaee",
              "#55BF3B", "#DF5353", "#7798BF", "#aaeeee"],        

          title: {
            style: {
               color: '#E0E0E3',
               textTransform: 'uppercase',
               fontSize: '20px'
            }
          },
          subtitle: {
            style: {
               color: '#E0E0E3',
               textTransform: 'uppercase'
            }
          },
          legend: {
            itemStyle: {
               color: '#E0E0E3'
            },
            itemHoverStyle: {
               color: '#FFF'
            },
            itemHiddenStyle: {
               color: '#606063'
            }
          },
           legendBackgroundColor: 'rgba(0, 0, 0, 0.5)',
           background2: '#505053',
           dataLabelsColor: '#B0B0B3',
           textColor: '#C0C0C0',
           contrastTextColor: '#F0F0F3',
           maskColor: 'rgba(255,255,255,0.3)'

   };
    

  Highcharts.setOptions(Highcharts.theme);

  var legendOptions= {
          enabled: true,
          floating: true,
          align: 'right',
          layout: 'horizontal',
          verticalAlign: 'top',
          //shadow: true
  };


  // Create the chart
  var tempOptions = {
          legend: legendOptions,
          chart : {
            renderTo: $('#temp-highstock')[0],              
          },
      series : [      
      ]
  };
  var humidityOptions = {
          legend: legendOptions,
          chart : {
            renderTo: $('#humidity-highstock')[0],              
          },
      series : [      
      ]
  };

  tempHighstock = new Highcharts.StockChart(tempOptions);
  humidityHighstock = new Highcharts.StockChart(humidityOptions);

}

}(jQuery,ko));