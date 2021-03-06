E.setFlags({pretokenise:1});

pinMode(D17,"input",false);
function KickWd(){
    if(!D17.read())E.kickWatchdog();
}
var wdint=setInterval(KickWd,5000); // 5 secs
E.enableWatchdog(20, false); // 20 secs
E.kickWatchdog();

const STOR = require("Storage");

function anom89(){ // not need for latest Espruino build
    poke8(0x40003FFC,0);
    poke8(0x40003FFC,1);
    SPI1.setup({sck:D2, mosi:D3, baud: 8000000});
}

var P8I2C = new I2C();
P8I2C.setup({scl:D7,sda:D6,bitrate:200000});

const P8 = {
    ON_TIME: 10,
    BRIGHT : 3,
    FACEUP:true,
    VIBRATE:true,
    awake : true,
    time_left:10,
    ticker:undefined,
    getBattery: (v)=>{
    	var v = P8.batV();
    	v = v<3.7?3.7:v;
    	return Math.floor((v-3.7)*200);
    },
    buzz: (v)=>{
        v = v? v : 100;
        if (v<=50){
            digitalPulse(D16,true,v);
        } else {
            D16.set();
            setTimeout(()=>{D16.reset();},v);
        }
    },
    batV: (s) => { //battery voltage function from enaon https://github.com/enaon/eucWatch/
      let v=7.1*analogRead(D31);
      if (s) v=(v*100-345)*1.43|0; //if (v>=100) v=100;
      let hexString = ("0x"+(0x50000700+(D31*4)).toString(16));
      poke32(hexString,2); // disconnect pin for power saving, otherwise it draws 70uA more 
      return v;
    },
    isPower:()=>{return D19.read();},
    setLCDTimeout:(v)=>{P8.ON_TIME=v<5?5:v;},
    setLCDBrightness:(v)=>{P8.BRIGHT=v; brightness(v);},
    init:()=>{
            var s = STOR.readJSON("settings.json",1)||{ontime:10, bright:3, timezone:1,faceup:false,vibrate:true};
            P8.ON_TIME=s.ontime;
            P8.time_left=s.ontime;
            P8.BRIGHT=s.bright;
            P8.FACEUP=s.faceup;
            P8.VIBRATE=(typeof s.vibrate!='undefined')?s.vibrate:true;
            E.setTimeZone(s.timezone);
            if (s.HID) { // Human interface device
            var p8hid;
            if (s.HID=="joy") p8hid = E.toUint8Array(atob("BQEJBKEBCQGhAAUJGQEpBRUAJQGVBXUBgQKVA3UBgQMFAQkwCTEVgSV/dQiVAoECwMA="));
            else if (s.HID=="kb") p8hid = E.toUint8Array(atob("BQEJBqEBBQcZ4CnnFQAlAXUBlQiBApUBdQiBAZUFdQEFCBkBKQWRApUBdQORAZUGdQgVACVzBQcZAClzgQAJBRUAJv8AdQiVArECwA=="));
            else /*kbmedia*/p8hid = E.toUint8Array(atob("BQEJBqEBhQIFBxngKecVACUBdQGVCIEClQF1CIEBlQV1AQUIGQEpBZEClQF1A5EBlQZ1CBUAJXMFBxkAKXOBAAkFFQAm/wB1CJUCsQLABQwJAaEBhQEVACUBdQGVAQm1gQIJtoECCbeBAgm4gQIJzYECCeKBAgnpgQIJ6oECwA=="));
            NRF.setServices({}, {uart:true, hid:p8hid});
  }
      else{
      NRF.setAdvertising({}, { name:"P8",connectable:true });
      }
    },
    sleep:() => {
        P8.awake = false;
        brightness(0);
        TC.stop();
        P8.emit("sleep",true);
        g.flip(); //make sure finished with SPI before stopping it.
        g.lcd_sleep();
       // setTimeout(anom89,100);
    },
    wake:()=> {
        P8.awake = true;
        P8.time_left = P8.ON_TIME;
        TC.start();
        g.lcd_wake();
        P8.emit("sleep",false);
        brightness(P8.BRIGHT);
        P8.ticker = setInterval(P8.tick,1000);
    },
    tick:()=>{
        P8.time_left--;
        if (P8.time_left<=0){
           if (P8.ticker) P8.ticker=clearInterval(P8.ticker);
           P8.emit("sleep",true);
           P8.sleep();
        }
    }
};

function watchBat(){
    pinMode(D19,"input",false);
    setWatch(()=>{
      if(!P8.awake) P8.wake();
      P8.emit("power",D19.read());
  },D19,{edge:"both",repeat:true,debounce:0});
}

setWatch(function(e){
	var isLong = (e.time-e.lastTime)>2.0; //If the button is held down longer than 2 Seconds
	if (isLong) load("cliock.app.js");		//Load the watchface
	else
	{
		if(P8.awake) 
			P8.sleep();	
		else
			P8.wake()
	}
}, D17, {repeat:true, debounce:50, edge:"falling"});

P8.init();
eval(STOR.read("lcd.js"));
var g = ST7789();
brightness(P8.BRIGHT);
eval(STOR.read("touch.js"));
TC.start();
TC.on('touch',(p)=>{P8.time_left=P8.ON_TIME;});
TC.on('swipe',(d)=>{P8.time_left=P8.ON_TIME;});
TC.on("longtouch", (p)=> {P8.time_left=P8.ON_TIME;}); 
if (P8.FACEUP && STOR.read("accel.js")){ 
    eval(STOR.read("accel.js"));
    ACCEL.init();
    ACCEL.on("faceup",()=>{if (!P8.awake) P8.wake();});
}
P8.ticker = setInterval(P8.tick,1000);
P8.POWER=D19.read();
watchBat();

//load app boot.js in boot.
require('Storage').list(/\.boot\.js/).forEach(bootFile=>{
  eval(require('Storage').read(bootFile));
});
