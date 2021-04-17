const store = require('Storage');
eval(store.read("menu.js"));
eval(store.read("prompt.js"));

const STOR = require("Storage");

const n = 9;
var nstart = 0;
var nend;
var m;
var files;

function delete_file(fn) {
  E.showPrompt("Delete\n"+fn+"?", {buttons: {"No":false, "Yes":true}}).then(function(v) {
    if (v) {
      if (fn.charCodeAt(fn.length-1)==1) {
        var fh = STOR.open(fn.substr(0, fn.length-1), "r");
        fh.erase();
      }
      else STOR.erase(fn);
    }
  }).then(function() { filed=[];files=get_pruned_file_list(); }).then(drawMenu);
}

function get_length(fn) {
  var len;
  if (fn.charCodeAt(fn.length-1)==1) {
    var fh = STOR.open(fn.substr(0, fn.length-1), "r");
    len = fh.getLength();
  }
  else len = STOR.read(fn).length;
  return len;
}

function visit_file(fn) {
  var menu = {
    '' : {'title' : fn + (fn.charCodeAt(fn.length-1)==1 ? "(S)" : "")}
  };
  var qJS = fn.endsWith(".js");
  menu['Length: '+get_length(fn)+' bytes'] = function() {};
  if (qJS && !fn.endsWith(".wid.js")) menu['Load file'] = function() { load(fn); }
  if (fn.endsWith(".img")) menu['Display image'] = function() { g.clear().drawImage(STOR.read(fn),0,20); }
  menu['Delete file'] = function () { delete_file(fn); }
  menu['< Back'] = drawMenu;
  E.showMenu(menu);
}

function drawMenu() {
  nend = (nstart+n<files.length)?nstart+n : files.length;
  var menu = {
    '': { 'title': 'Dir('+nstart+'-'+nend+')/'+files.length }
  };
  menu["< prev"] = function() {
    nstart -= n;
    if (nstart<0) nstart = files.length-n>0 ? files.length-n : 0;
    menu = {};
    drawMenu();
  }
  for (var i=nstart; i<nend; ++i) {
    menu[files[i]] = visit_file.bind(null, files[i]);
  }
  menu["> next"] = function() {
    if (nstart+n<files.length) nstart += n;
    else nstart = 0;
    menu = {};
    drawMenu();
    m.move(-1);
  }
  m = E.showMenu(menu);
}

function get_pruned_file_list() {
  // get storagefile list
  var sf = STOR.list(/\x01$/).map(s=>s.slice(0,-1));
  var sffilter = f=>!sf.includes(f.slice(0,-1)) || f.endsWith("\x01");
  // get files - put '.' last
  var fl = STOR.list(/^[^\.]/).filter(sffilter);
  fl.sort();
  fl = fl.concat(STOR.list(/^\./).filter(sffilter).sort());
  return fl;
}

files = get_pruned_file_list();
setTimeout(drawMenu,500);