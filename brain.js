self.addEventListener("message", handleMessage);

function handleMessage(event) {	
	switch( event.data.request ){
		case "locate" :
			computeLocation(event.data.parameters)
			break;
			
		case "track" :
			computeTrack(event.data.parameters, event.data.resizeMap)
			break;
			
		case "test" :
			test(event.data.parameters, event.data.randoms);
			break;
			
		default:
			return;
			break;
	}
}



function computeTrack(data, resizeMap) {

	var [a, e, i, L_omega, mu, omega, vmin, vmax, vstep, t, precision] = data;
    	
    	

	// Preliminary values
    var prelims = getPreliminaryValues(data);


	var coords = []
	var data_table = []
	
	 // V is the true anomaly in degrees (position of the satellite on its orbit)
    for( v = vmin; v <= vmax; v += vstep ){
    
        
        /* COORDINATES COMPUTATION */
		result = getCoordsFromRealAnomaly(data, v)
       
        // save the results in our variables
        coords.push({lat: result[0], lng: result[2]});
        data_table.push([v, result[3], result[0], result[1], result[2]]);
        
    }
        
	
	self.postMessage({
		request: "track",
		result: [prelims, coords, data_table],
		resizeMap: resizeMap
	});
}

function computeLocationDichotomy(data) {
	/* FETCH ORBITAL PARAMETERS */
    var [a, e, i, L_omega, mu, omega, vmin, vmax, vstep, t, precision]
    	= data;

    /*
    Using dichotomy, we compute the time T for Vmin, Vmax and Vmed
    (Vmed being the average between Vmin and Vmax)
    Then we compare them with the time T we want
    in order to reduce the interval to a given precision
    
    TODO : find the mathematical way to do it !
    */
    
    
    var cur_vmin = vmin;
    var cur_vmax = vmax;
    var cur_vmed = (cur_vmin + cur_vmax)/2
    var extend = false;
    
    var t_vmin = null;
    var t_vmax = null;
    var t_vmed = null;
    
    // Preliminary values
    var [Vc, Tp] = getPreliminaryValues(data);

    // Looping until we have enough precision
    while( Math.abs(cur_vmin - cur_vmax) > Math.pow(10, precision) ){
    
    	
        /* COMPUTING T (TIME ARGUMENT) FOR OUR VMIN, VMAX AND VMED */
    	if( !t_vmin ){
    		t_vmin = getTimeFromRealAnomaly(data, cur_vmin, [Vc, Tp])
    	}
    	
    	if( !t_vmax ){
    		t_vmax = getTimeFromRealAnomaly(data, cur_vmax, [Vc, Tp])
    	}
    
    	if( !t_vmed ){
    		t_vmed = getTimeFromRealAnomaly(data, cur_vmed, [Vc, Tp])
    	}
        
        
        
            /* COMPARE WITH T WE WANT AND REDUCE THE INTERVAL */
        if( t_vmin < t && t_vmed > t ){
            cur_vmin = cur_vmin;
            cur_vmax = cur_vmed;
            t_vmax   = t_vmed;
            
            
            cur_vmed = (cur_vmax + cur_vmin)/2
            t_vmed = null;
        } else if( t_vmax > t && t_vmed < t ){
            cur_vmax = cur_vmax;
            cur_vmin = cur_vmed;
            t_vmin   = t_vmed;
            
            cur_vmed = (cur_vmax + cur_vmin)/2
            t_vmed = null;
        } else {
     
            // T is not in the interval, extend the search
 
            if( t < t_vmin ){
                cur_vmin -= vstep;
                t_vmin = null;
                
                self.postMessage({
                	request: "locate",
                	result: {new_vmin: cur_vmin},
                	found: false
                });
                
            } else if( t > t_vmax ){
                cur_vmax += vstep;
                t_vmax = null;
                
                self.postMessage({
                	request: "locate",
                	result: {new_vmax: cur_vmax},
                	found: false
                });
                
            }
            
        }
        
        

    }
    
    // Save v
    var v = cur_vmed;
    
    // Compute its coordinates
    var coords = getCoordsFromRealAnomaly(data, v, [Vc, Tp]);
    
    // Return the results
    self.postMessage({
    	request: "locate",
    	result: coords,
    	found: true
    });
    
}



function computeLocation(data) {
	/* FETCH ORBITAL PARAMETERS */
    var [a, e, i, L_omega, mu, omega, vmin, vmax, vstep, t, precision] = data;
    
    // Preliminary values
    var [Vc, Tp] = getPreliminaryValues(data);
    
    var v = getRealAnomalyFromTime(data, t, [Vc, Tp]);
        
    
    // Compute its coordinates
    var coords = getCoordsFromRealAnomaly(data, v, [Vc, Tp]);
    
    
    // Return the results
    self.postMessage({
    	request: "locate",
    	result: coords,
    	found: true
    });
    
}



function getTimeFromRealAnomaly(data, v, prelimValues=null) { // t (s)
	/* FETCHING ORBITAL PARAMETERS */
	var [a, e, i, L_omega, mu, omega, vmin, vmax, vstep, t, precision] = data;
    
    // Preliminary values
    if( !prelimValues ){
    	var [Vc, Tp] = getPreliminaryValues(data);
    } else {
    	var [Vc, Tp] = prelimValues;
    }
	
	// Correction computation (x is between k*k1+k2 and (k+1)*k1+k2)
    var x = Math.rad(v), k1 = 2*Math.PI, k2 = Vc, corr1 = 0; //data
    if( x > 0 ) {
        while( x > k1-k2 ){ x -= k1; corr1++; }
        corr1 *= 2;
        if( x > k2 ){ corr1 += 1;}	
        
    } else if( x < 0 ){
        while( x < -k1+k2 ){x += k1; corr1--;}                
        corr1 *= 2;
        if( x < -k2 ){ corr1 -= 1; }
        
    } else { corr1 = 0; }

    // Computing the value
    var t_asin = Math.sqrt(1-(e*e))*Math.sin(Math.rad(v))
    t_asin    /= 1+e*Math.cos(Math.rad(v))
    var t_e    = Math.sqrt(1-(e*e))*Math.sin(Math.rad(v))
    var t_inside = Math.asin(t_asin) - e * (t_e) / (1+e*Math.cos(Math.rad(v)));
    
    var t = Math.sqrt(Math.pow(a, 3)/mu) 
    t    *= corr1*Math.PI + (Math.pow(-1, corr1) * t_inside)
    t    += Tp;
    
    return t
}

function getRealAnomalyFromTime(data, t, prelimValues=null) {
	/* FETCHING ORBITAL PARAMETERS */
	var [a, e, i, L_omega, mu, omega, vmin, vmax, vstep, t, precision] = data;
    
    // Preliminary values
    if( !prelimValues ){
    	var [Vc, Tp] = getPreliminaryValues(data);
    } else {
    	var [Vc, Tp] = prelimValues;
    }
    
    /* solve equation : x^3 + cx + d = 0 */
    var b = Math.sqrt(mu/(a*a*a)) * (t - Tp);
    var c = (6 - (6*e))
    var d = (-6 * b)
    var delta_root = Math.sqrt((d*d) + ((4*c*c*c)/27))
    var x = Math.cbrt((-d-delta_root)/2)+Math.cbrt((-d+delta_root)/2)
    
    
    
    /* solve equation : pv^3 + qv^2 + rv + s = 0 */
    var p = a/6
    var q = (e*x)/2
    var r = a
    var s = -x*(e+1)
    
    var v_in1 = (-Math.pow(b, 3)/(27*a*a*a))+((b*c)/(6*a*a))-(d/(2*a));
    var v_in2 = (v_in1*v_in1)+Math.pow((c/(3*a))-((b*b)/(9*a*a)) , 3)
    
    
    var v = Math.cbrt(v_in1+Math.sqrt(v_in2)) 
        v += Math.cbrt(v_in1-Math.sqrt(v_in2)) 
        v -= b/(3*a)
        
        
   	return v;
}

function getCoordsFromRealAnomaly(data, v, prelimValues=null) { // v (deg)

	/* FETCHING ORBITAL PARAMETERS */
	var [a, e, i, L_omega, mu, omega, vmin, vmax, vstep, t, precision] = data; 
	
	// Preliminary values
	if( !prelimValues ){
		var [Vc, Tp] = getPreliminaryValues(data);
	} else {
		var [Vc, Tp] = prelimValues;
	}
   
    
    
	// Compute the time argument
	var t = getTimeFromRealAnomaly(data, v)
	
    	/* COMPUTING LA (LATITUDE) */
    var La = Math.sin(Math.rad(i)) * Math.sin(Math.rad(omega)+Math.rad(v));
    La     = Math.deg(Math.asin(La))
    
        /* COMPUTING LO (FIX-EARTH LONGITUDE) */
    // Correction computation (x is between k1+k2b and k1+(k2+1)b)
    	//data            
    var x = Math.rad(v)
    var k1 = -Math.rad(omega) - Math.rad(90)
    var k2 = Math.rad(180);
    var corr2 = 0;                                                                
    	//correction
    if( x > k1 ){
        while( x > k1+k2 ){
            x -= k2;
            corr2++;
        }
    } else if( x < k1 ){
        while( x < k1-k2 ){
            x += k2;
            corr2--;
        }
        corr2--;
    } else {
        corr2 = 0;
    }
    
    // Computing the value
    
    var Lo_in_sin = Math.rad(omega) + Math.rad(v)
    var Lo_in_fac = Math.cos(Math.rad(i))/Math.cos(Math.rad(La))
    
    var Lo_inside = Math.sin(Lo_in_sin)*Lo_in_fac
    Lo_inside     = Math.asin(Lo_inside)
    
    var Lo = undefined;
    if( i < 90 ) { //PROGRADE
        Lo = corr2*Math.PI + (Math.pow(-1, corr2) * Lo_inside)
    } else {       //RETROGRADE
        Lo = -corr2*Math.PI - (Math.pow(-1, corr2) * Lo_inside)
    }
    Lo = Math.deg(Lo);
    
    
        /* COMPUTING LS (ROTATING EARTH LONGITUDE) */
    // Computing the value
    var Ls = L_omega + Lo - (360/(23*56*60+4))*t;
    
    // Computing the correction
    while( Ls < -180 ){ Ls += 360 }
    while( Ls > 180 ){ Ls -= 360 }
    
    
        /* CHECKING THE VALUES */
    // La
    if( La > 90 ){
        console.warn("La > 90° (", La, ") pour v = ", v, "°");
    } else if( La < -90 ){
        console.warn("La < 90° (", La, ") pour v = ", v, "°");
    }
    
    // Ls
    if( Ls > 180 ){
        console.warn("Ls > 180° (", Ls, ") pour v = ", v, "°");
    } else if( Ls < -180 ){
        console.warn("Ls < 180° (", Ls, ") pour v = ", v, "°");
    }
    
    return [La, Lo, Ls, t]
}



function getPreliminaryValues(data) {
	var [a, e, i, L_omega, mu, omega, vmin, vmax, vstep, t, precision]
    	= data;
    	
    var omega_rad = Math.rad(omega)
    	
	// Critical true anomaly, in radians
    var Vc = Math.acos(-e); 
    
    
    var Tp_arcsin = Math.sqrt(1-(e*e))
    Tp_arcsin    *= Math.sin(-omega_rad)
    Tp_arcsin    /= 1+(e*Math.cos(-omega_rad))
    
    var Tp_e      = Math.sqrt(1-(e*e))
    Tp_e         *= Math.sin(-omega_rad)
    Tp_e         /= 1+(e*Math.cos(-omega_rad))
  
    // Perigee time
    var Tp = -Math.sqrt(Math.pow(a, 3) / mu)  
	Tp    *= Math.asin(Tp_arcsin) - e*Tp_e; 
	
	return [Vc, Tp];
}

// Custom mathematical function
Math.rad = function(degrees) {
  return degrees * (Math.PI / 180);
};
Math.deg = function(radians) {
  return radians * (180 / Math.PI);
};

function test(data, randoms) {
	console.log("starting brain.js test ...");
	
	var prelim = getPreliminaryValues(data);
	var errors = [];
	
	while(randoms.length > 0) {	
		
		/* test : function set 1 (real anomaly / time) */
		runTest(1, errors, randoms, function(rand) {
			var intermediate = getRealAnomalyFromTime(data, rand, prelim);
			return getTimeFromRealAnomaly(data, intermediate, prelim);
		});
		
		i++ /* next test */
		
		
		/* test : function set 2 (rad / deg) */
		runTest(2, errors, randoms, function(rand) {
			return Math.deg(Math.rad(rand));
		});
		
		
	}
	
	for( var i = 0; i < errors.length; i++ ){
		
		if( errors[i] && errors[i].length < 100 && errors[i].length > 0){
			console.log("Set "+(i+1)+" successful but "+errors[i].length
						+" errors occured : ", errors[i]);
		} else if( errors[i] && errors[i].length >= 100) {
			console.log("Set "+(i+1)+" failed !");
		} else {
			console.log("Set "+(i+1)+" successful !");
		} 
		
	}
	
	console.log("Brain.js test finished");
	
	
	function runTest(set, errors, randoms, testFct) {
		if( !errors ){ errors = []; }if( !errors[set-1] ){ errors[set-1] = []; }
		if( errors[set-1].length < 100 ) {
			var randomTest = randoms.pop();
			var result = testFct(randomTest)
			if( Math.abs((result - randomTest)/Math.abs(randomTest)) > 0.01 ) {
				errors[set-1].push({test: randomTest, result: result});
			}
		}
	}
	
		
}
