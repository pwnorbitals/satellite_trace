//Global variables
var map;                    // dynamic map
var track;                  // ground track
var mode = 1;               // mode : track / locate
var marker;                 // satellite marker
var map_displayed = true;   // map shown (if false, tables shown)
var coord_label;            // label to show coordinates
var worker;                 // worker to compute CPU-intensive stuff
var possible_speeds 		// Possible time warps for simulation
	= [1, 2, 5, 10, 50, 100] 
var simulation_speed = 0;   // Time warp (index of possible speeds)
var animation_id = null;    // interval ID for live simulation
var last_frame_time = null; // Last frame timestamp for live simulation
var user_data = null;       // User orbital parameters & other inputs
var electron = false;       // Is the application executed in electron ?


// Dynamic map initialization
function initMap() {
    
    // Checking if ran with electron
    if( typeof(require) != "undefined") {
        var remote = require('electron').remote;     
        if(remote.getGlobal('electron').inEngine || userAgent.indexOf(' electron/') > -1) {
        
        	// If electron is detected, set the flag
			electron = true;
            
            // Enable the "debugging window button"
            var debug_win_button = document.getElementById("debugging_window")
            debug_win_button.style.display = "inline-block";
            debug_win_button.addEventListener('click', function() {
			    var win = remote.getCurrentWindow()
            	win.webContents.openDevTools({mode: "undocked"});	
            	
            });
            
        }  
    }
    
    // Checking browser type
    if(!(window.chrome || electron)) {
    
    	// Display a warning message if Chrome is not used
    	var warning_msg = "It is recommanded to use the last "
    	warning_msg    += "version of the Chrome browser. No test "
    	warning_msg    += "has been done on other browsers and "
    	warning_msg    += "the web page visual aspect can be greatly altered."
        alert(warning_msg)
    }
    
    // Checking internet connection
    if(!navigator.onLine || !google) {
    
    	// Hide the map
       switchDisplay();
       
       	// Show an error message
       document.getElementById("switch").style.display = "none";
       document.getElementById("map").style.display = "none";
       var error_msg = "Couldn't connect to Google Maps API, "
       error_msg    += "Please check your Internet connection"
       alert(error_msg)
       
       	// Close the window if possible, hide it otherwise
       if( electron ){
       		remote.getCurrentWindow().close();
       } else if( window ){
       		window.close();
       } else {
       		document.querySelectorAll('html').display = "none";
       }
       
       	// Stop loading the page
       return;
    }
    
    
    // Map settings
    map = new google.maps.Map(document.getElementById('map'), {
        center: {lat: 48.8534100, lng: 2.3488000},
        zoom: 3
      });
      
    // Track settings
    track = new google.maps.Polyline({
        map: map,
        geodesic: true,
        strokeColor: '#FF0000',
        strokeOpacity: 1.0,
        strokeWeight: 2
    });
    
    // Marker settings
    marker = new google.maps.Marker ({
        draggable: false,
        animation: google.maps.Animation.DROP,
        icon: {
            url: "satellite.png",
            size: new google.maps.Size(256, 256),
            scaledSize: new google.maps.Size(64, 64),
            origin: new google.maps.Point(0, 0),
            anchor: new google.maps.Point(32, 32)
        }
      });
      
  	// Coordinates text settings
	coord_label = new MapLabel({
		fontSize: 13,
		align: 'left'
	});
      
      
    
    // Show night shadows, updated every 10 seconds 
    nite.init(map)
    window.setInterval(function() { nite.refresh() }, 10000);
    
    // Show fullscreen button if supported
    if( screenfull.enabled ){
    	document.getElementById("fullscreen").style.display = "inline-block";
    }
    
    // Update user information
    updateUserData();
    
    // Add button events handlers
    	// Fullscreen
    document.getElementById("fullscreen").addEventListener("click", function() {
    	screenfull.request(document.getElementById("map"));
    });
    	// Display switch
    document.getElementById("switch").addEventListener("click", function() {
    	switchDisplay();
    });
    	// Live simulation
    document.getElementById("simulate_live_input")
    	.addEventListener("click", function() {
    		updateUserData();
    		toggleSimulation(this)
	});
		// Mode change
    document.getElementById("change_mode_input")
    	.addEventListener("click", function() {
    		chgMode();
	});
    
    // Simulation speed event handlers
    document.getElementById("simulate_live_label")
    	.addEventListener("click", handleSimSpeedEvent);
    document.getElementById("simulate_live_label")
    	.addEventListener("contextmenu", handleSimSpeedEvent);
    document.getElementById("simulate_live_label")
    	.addEventListener("select", handleSimSpeedEvent);
    	
    
    // Automatic track and location refresh
    var inputs = document.querySelectorAll("input");
    for(var i = 0; i < inputs.length; i++) {
    	inputs[i].addEventListener("change", function() {
    		updateUserData();
    		findTrack(false);
    		findLocation();
    	});
    }
    	
    // Worker initialization
    worker = new Worker("./brain.js");
    worker.addEventListener("message", handleWorkerMessage);
    
    // Refresh ground track, location and center the view
    findTrack(true);
    findLocation();
}

// Switches between showing the map or the tables
function switchDisplay() {
    if(map_displayed) { //map shown, we hide it and show the tables
    
        map_displayed = false;
        document.getElementById('map').style.display = "none";
        document.getElementById('values').style.display = "block";
        document.getElementById('preliminaries').style.display = "block";
        document.getElementById('switch').innerHTML = "Dynamic map";
        
        document.getElementById('fullscreen').style.visibility = "hidden";
        
    } else { //tables shown, we hide them and show the map
    
        map_displayed = true;
        document.getElementById('map').style.display = "block";
        document.getElementById('values').style.display = "none";
        document.getElementById('preliminaries').style.display = "none";
        document.getElementById('switch').innerHTML = "Data table";
        
        document.getElementById('fullscreen').style.visibility = "visible";
        
    }
}

// Checks the precision limits to avoid a long computation time
function checkPrecision(input) {
    if( parseInt(input.value) < -10 ){
        input.value = -10;
        alert("Accuracy too high, reduced to avoid high CPU load");
    }
}

// Animates the satellite
function animateSatellite(timestamp) {

	// First call, we set the timestamp, schedule the frame and return
	if( !last_frame_time ) {
		last_frame_time = timestamp;
		animation_id = requestAnimationFrame(animateSatellite);
		return;
	}
	
	// FPS calculation
	var fps = 1/(timestamp - last_frame_time)*1000;
	
	// New time value
    var new_value = user_data[9] + (1/fps)*possible_speeds[simulation_speed];
    document.getElementById('t_input').value = new_value.toFixed(9);
    user_data[9] = new_value;
    
    // Locate the satellite	
    findLocation();
	
	// Update the timestamp and schedule next frame
	last_frame_time = timestamp;
	animation_id = requestAnimationFrame(animateSatellite);
	
}

// Toggles live position simulation
function toggleSimulation(checkbox) {
	if( animation_id ) {	// Simulation was running, stop and reset vars
		cancelAnimationFrame(animation_id);
		last_frame_time = null;
		animation_id = null;
		document.getElementById('t_input').disabled = "";
	} else { 				// Start the animation by scheduling a frame
		animation_id = requestAnimationFrame(animateSatellite);
		document.getElementById('t_input').disabled = "true";
	}
}

// Changes the simulation speed according to the mouse event fired
function handleSimSpeedEvent(event) {
	event.preventDefault(); // Stop it from firing other events
	var sim_speed_txt = document.getElementById("sim_speed")
	
	switch( event.type ){
		case "click": 	// On click, increase the simulation speed or reset it
			if( simulation_speed+1 < possible_speeds.length ){
				simulation_speed++;
			} else {
				simulation_speed = 0;
			}
			
			sim_speed_txt.innerHTML = possible_speeds[simulation_speed]; 
			break;
		
		case "contextmenu":	// On right click, reset the animation speed
			simulation_speed = 0;
			sim_speed_txt.innerHTML = possible_speeds[simulation_speed];
			break;
	
		default:
			break;
	}
	
	return false; // Security : stop it from firing other events
}


function handleWorkerMessage(event) {
	var data = event.data;
	
	// Corrupted message, discard
	if( !data.request || !data.result ){
		console.error("no request/result from worker !");
		return;
	}
	
	switch( data.request ){
		case "track" : // The track is computed
			var [prelims, coords, data_table] = data.result;
			onTrackComputed(prelims, coords, data_table, data.resizeMap);
			break;
			
		case "locate" : // Satellite location event
			if(data.found) { // Successful computaton
				onLocationComputed(data.result);
			} else {	// Needs range extension
				
				// Extend vmax if needed
				if(data.result.new_vmax) {
					var new_vmax = data.result.new_vmax;
					
					var query = "keep_v_interval_input"
					var keep_v_interval
						= document.getElementById(query).checked;
						
					if( keep_v_interval ) {
						
						var query = "vmax_input"
						var old_vmax = document.getElementById(query).value
						old_vmax = parseFloat(old_vmax);
						
						var difference = old_vmax - new_vmax;
						
						var query = "vmin_input"
						var old_vmin = document.getElementById(query).value
						old_vmin = parseFloat(old_vmin);
						
						var query = "vmin_input"
						document.getElementById(query).value
							= (old_vmin - difference).toFixed(2);
						
						
					}
					
					var query = "vmax_input"
					document.getElementById(query).value
						= new_vmax.toFixed(2);
						
					updateUserData();
				}
				
				// Extend vmin if needed
				if(data.result.new_vmin) {
					var new_vmin = data.result.new_vmin;
					
					var query = "keep_v_interval_input"
					var keep_v_interval
						= document.getElementById(query).checked;
						
					if( keep_v_interval ) {
						
						var query = "vmin_input"
						var old_vmin = document.getElementById(query).value
						old_vmin = parseFloat(old_vmin);
						
						var difference = old_vmin - new_vmin;
						
						var query = "vmax_input"
						var old_vmax = document.getElementById(query).value
						old_vmax = parseFloat(old_vmax);
						
						var query = "vmax_input"
						document.getElementById(query).value
							= (old_vmax - difference).toFixed(2);
						
						
					}
					
					var query = "vmin_input"
					document.getElementById(query).value
						= new_vmin.toFixed(2);
					
					updateUserData();
					
					
					
				}
				
				// Restart the computation
				findTrack(false);
			}
			
			break;
			
		default :
			break;
	}
}

// Asks the worker thread to compute the track
function findTrack(resizeMap=true) {
	worker.postMessage({
		request: "track", parameters: user_data, resizeMap: resizeMap
	});
}

// Handle a successful track computation from the worker thread
function onTrackComputed(prelims, coords, data, resizeMap) {

	// Clear the tables
    var rows = document.querySelectorAll('#values tr');
    for (var k = 0; k < rows.length; k++) {
        if( rows[k].id != "headers" ){
            rows[k].remove();
        }
    }
    var rows = document.querySelectorAll('#preliminaries tr');
    for (var k = 0; k < rows.length; k++) {
        if( rows[k].id != "prelim_headers" ){
            rows[k].remove();
        }
    }
    
	// Add Vc and Tp to the table
    var row = document.getElementById('preliminaries').insertRow(-1);
    for( var k = 0; k < prelims.length; k++) {
        var cell = row.insertCell(-1);
        cell.innerHTML = prelims[k].toFixed(4);
    }
    
    
    // Populate the data table
    for( var i = 0; i < data.length; i++ ){
        var row = document.getElementById('values').insertRow(-1);
        var toAdd = data[i]
        for( var k = 0; k < toAdd.length; k++) {
            var cell = row.insertCell(-1);
            cell.innerHTML = toAdd[k].toFixed(5);
        }
    }
    
    // Google Maps : draw a path from coordinates
    track.setPath(coords);
    
    
    // Extend the map to be able to see all coordinates if needed
    if(resizeMap) {
    	var limits = new google.maps.LatLngBounds();
		for( var i = 0; i < coords.length; i++ ){
		    limits.extend(coords[i]);
		}
		map.fitBounds(limits);
    }
    
}

// Ask the worker thread to compute the satellite location
function findLocation() {
	worker.postMessage({
		request: "locate", parameters: user_data
	});

    
}

// Handles a successful location computation
function onLocationComputed(coords) {
	var [La, Lo, Ls, t] = coords;
	
	var position = new google.maps.LatLng(La, Ls)

	// Draw the satellite
    marker.setPosition(position)
    marker.setTitle("("+La.toFixed(2)+"; "+Ls.toFixed(2)+")")
    
    // Show its coordinates
    /*
    var coords_text = '          ('+La.toFixed(2)+'; '+Ls.toFixed(2)+")"
    coord_label.set('text',  coords_text);
    coord_label.set('position',  position);
    */
    
    var query = "center_satellite_input"
    var center_sat = document.getElementById(query).checked;
    if( center_sat ){
    	map.panTo({lat: coords[0], lng: coords[2]});
    }
    
    
}





// mode switch : ground track / localization
function chgMode() {
    if( mode == 1 ){
        // previous mode : ground track
    
        var inputs_1 = document.querySelectorAll('.mode_1')
        var inputs_2 = document.querySelectorAll('.mode_2')
        for( var i = 0; i < inputs_1.length; i++ ){
            inputs_1[i].style.display = "none"
        }
        for( var i = 0; i < inputs_2.length; i++ ){
            inputs_2[i].style.display = "inline-block";
        }
        mode = 2;
        
        if(!marker.getMap()) {
        	marker.setMap(map); coord_label.set('map',  map);
        }
        
    }else if( mode == 2){
        //previous mode : localization
        
        var inputs_1 = document.querySelectorAll('.mode_1')
        var inputs_2 = document.querySelectorAll('.mode_2')
        for( var i = 0; i < inputs_2.length; i++ ){
            inputs_2[i].style.display = "none"
        }
        for( var i = 0; i < inputs_1.length; i++ ){
            inputs_1[i].style.display = "inline-block";
        }
        mode = 1;
        
        if (!animation_id) {
		    marker.setMap(null); 
		    coord_label.set('map',  null);
		}
		    
    }else{
        // previous mode : unknown
        
        mode=1;
        chgMode();
    }
}


// Input manipulation functions
function getInputValue(name) {
	var query = name+"_input"
	var inputs = document.getElementById(query)
	return inputs.value
};

// Update user data variables according to the fields
function updateUserData() {
	var a = parseFloat(getInputValue("a")); //Km
    var e = parseFloat(getInputValue("e")); //no unit
    var i = parseFloat(getInputValue("i")); //deg
    var L_omega = parseFloat(getInputValue("L_omega")); //deg
    var mu = parseFloat(getInputValue("mu")); //km^3 / s
    var omega = parseFloat(getInputValue("omega")); //deg
    var vmax = parseFloat(getInputValue("vmax")); //deg
    var vmin = parseFloat(getInputValue("vmin")); //deg
    var vstep = parseFloat(getInputValue("vstep")); //no unit
    var precision = parseInt(getInputValue('precision')); //no unit
    var t = parseFloat(getInputValue('t')); //s
    
    user_data = [a, e, i, L_omega, mu, omega, vmin, vmax, vstep, t, precision];
}

function test() {
	
	var random_sample = 1e4	;

	console.log("generating random values ... ")
	var randoms = [];
	for( var i = 0; i < random_sample; i++ ){
		do {
			var rand = getRand();
			if( !randoms.includes(rand) ){
				randoms.push(rand);
				break;
			}
		} while(1);
	}
	
	worker.postMessage({
		request: "test", parameters: user_data, randoms: randoms
	});
	
	/* see http://stackoverflow.com/a/43080127/3753446 */
	function getRand() {
		function IEEEToDouble(f)
		{
			var buffer = new ArrayBuffer(8);
			(new Uint32Array(buffer))[0] = f[0];
			(new Uint32Array(buffer))[1] = f[1];
			return new Float64Array(buffer)[0];
		}
		
		var f = null;
		do {
			var array = new Uint32Array(2); 
			
			
			window.crypto.getRandomValues(array);
			f = IEEEToDouble(array);
		} while( f == NaN || f == null || f == Infinity);
		
		return f;
	}
}

// Call the init function when the content is loaded
window.addEventListener("load", initMap);
