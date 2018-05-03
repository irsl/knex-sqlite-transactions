var assert = require("chai").assert;

const knexLib = require("knex");

describe('multi transactions', function() {
	const databaseFile = "./mocha.sqlite";

	var knex;
    var inserted = 0;

    const tableName = "x";
    const tableName2 = "y";


	it("preparation", function(){
	  knex = knexLib({
	  	      "client": "sqlite3",
			  "connection": {
		  	    "filename": databaseFile
		 	    },
		        "useNullAsDefault": true,
	      })

	  const fs = require("fs");

      try{
      	 fs.unlinkSync(databaseFile);
      	 fs.unlinkSync(databaseFile+"-journal");
      }catch(x){
      }


	   return knex.raw("CREATE TABLE "+tableName+" (x INT)")
	   .then(()=>{
	      return knex.raw("CREATE TABLE "+tableName2+" (x INT)");
	   })
	})

	it("exceptions in transactions should not lock down the pool", function(done){
	  var aknex = knexLib({
	  	  	  "pool": {min:1, max:2},
	  	      "client": "sqlite3",
			  "connection": {
		  	    "filename": databaseFile
		 	    },
		        "useNullAsDefault": true,
	      })


       var exceptions = 0;
       var maxTimes = curTimes = 10;
       var insideTransactions = 0;
       var afterInsert = 0;

       knexTransactionError();

		function knexTransactionError(){
			if(curTimes <= 0) {
				 // we are done

				 assert.equal(insideTransactions, maxTimes);
				 assert.equal(afterInsert, maxTimes);
				 assert.equal(exceptions, maxTimes);

				 return done();
			}

			curTimes--;

			return aknex.transaction(trx=>{
				insideTransactions++;
				return trx(tableName2).insert({x:1})
				  .then(()=>{
				  	 // console.log("after insert");
				  	 afterInsert++;
   				     throw new Error("just for fun");
				  })
			})
        	.catch(ex=>{
		    	 exceptions++;
		    })
		    .then(()=>{
		    	return knexTransactionError();
		    })
		}

	})

	it("read operations should be good even when there is a transaction", function(done){
	       this.timeout(10000);

	        var allGood = false;
		    var transactionRunning = true;
	    	new Promise(function(resolve,reject){
	    		setTimeout(function(){
	    			 console.log("second thread: stuff starting");

       	    		return knex(tableName).count("*")
       	    		  .then((rows)=>{
       	    		  	 console.log("second thread: stuff queried", rows);

       	    		  	 assert.equal(transactionRunning, true);
       	    		  	 allGood = true;

       	    		  })
       	    		  .catch(done)


	    		}, 1000)
	    	});

	    	knex.transaction(trx=>{
	    		return trx(tableName).insert({x: inserted++})
	    		  .then(()=>{
	    		  	  console.log("first thread: stuff inserted");
	    		  	  return new Promise(function(resolve,reject){
	    		  	  	  setTimeout(function(){
	    		  	  	  	console.log("first thread: timeout finished");
	    		  	  	  	resolve();
	    		  	  	  }, 2000);
	    		  	  })

	    		  })
	    	})
  	        .then(()=>{
	  	       transactionRunning = false;
	  	       assert.equal(allGood, true);
	  	       done();
		    })
	    	.catch(done);
	});


	it("starting a transaction and trying to insert in the meanwhile", function(done){

	  this.timeout(10000);

	  inserted = 0;
	  var allGood = false;

	    	new Promise(function(resolve,reject){
	    		setTimeout(function(){
	    			console.log("second thread: stuff starting");

       	    		return knex(tableName).insert({x: inserted++})
       	    		  .then(()=>{
       	    		  	 console.log("second thread: stuff inserted");

       	    		  	 assert.equal(inserted, 2);
       	    		  	 allGood = true;

       	    		  })
	    			 .catch(done);


	    		}, 1000)
	    	})

	    	knex.transaction(trx=>{
	    		return trx(tableName).insert({x: inserted++})
	    		  .then(()=>{
	    		  	  console.log("first thread: stuff inserted");
	    		  	  return new Promise(function(resolve,reject){
	    		  	  	  setTimeout(function(){
	    		  	  	  	console.log("first thread: timeout finished");
	    		  	  	  	resolve();
	    		  	  	  }, 2000);
	    		  	  })
	    		  })
	    	})
 	  	    .then(()=>{
 	  	  	   assert.equal(allGood, true);
 	  	  	   return knex(tableName).count("* AS c")
	  	    })
	  	    .then(rows=>{
	  	    	assert.propertyVal(rows[0], "c", 3);
	  	    	done();
	  	    })
	    	.catch(done);
	})


	it("starting a transaction while another is locking", function(done){

	  this.timeout(10000);
	  inserted = 0;


	    	new Promise(function(resolve,reject){
	    		setTimeout(function(){
	    			 console.log("second thread: stuff starting");

	    			 return knex.transaction(trx=>{
           	    		return trx(tableName).insert({x: inserted++})
           	    		  .then(()=>{
           	    		  	 console.log("second thread: stuff inserted");

           	    		  	 assert.equal(inserted, 2);
                             done();

           	    		  })

	    			 })
	    			 .catch(done);

	    		}, 1000)
	    	})

	    	knex.transaction(trx=>{
	    		return trx(tableName).insert({x: inserted++})
	    		  .then(()=>{
	    		  	  console.log("first thread: stuff inserted");
	    		  	  return new Promise(function(resolve,reject){
	    		  	  	  setTimeout(function(){
	    		  	  	  	console.log("first thread: timeout finished");
	    		  	  	  	resolve();
	    		  	  	  }, 2000);
	    		  	  })
	    		  })
	    	})
	    	.catch(done);



	})


})
