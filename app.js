
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require('express-session');
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const findOrCreate = require('mongoose-findorcreate');
const https = require('https');
const app = express();
let alert = require('alert'); 

app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({
  extended: true
}));

app.use(express.static("public"));

app.use(session({
  secret: "Tottenham Sucks.",
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

//mongoose.connect("mongodb://localhost:27017/testDB", {useNewUrlParser: true});
mongoose.connect('mongodb+srv://surbhit:1234@cluster0.tas80.mongodb.net/testdb5', {useNewUrlParser: true, useUnifiedTopology: true});
//mongoose.set("useCreateIndex", true);


const buySchema = new mongoose.Schema({
    username:String,
    Crypto: String,
    Buyprice: Number,
    Quantity:Number,
    Total:Number,
  });
  const Buy= new mongoose.model("buy", buySchema);
  
  const sellSchema = new mongoose.Schema({
    username:String,
    Crypto: String,
    Sellprice: Number,
    Quantity:Number,
  });
  
  const Sell= new mongoose.model("sell", sellSchema); 
  

  const userSchema = new mongoose.Schema({
    Name: String,
    username:String,//email
    password:String,
    Cash: Number,
    Brought: [buySchema],
    Clist:[String],
    Sold: [sellSchema],
  });
  
userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy());

passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});

//const url='https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=false'



app.get("/", function(req, res){
  res.render("home");
});

app.get("/login", function(req, res){
  res.render("login");
});

app.get("/register", function(req, res){
  res.render("register");
});

app.get("/logout", function(req, res){
  req.logout();
  res.redirect("/");
});

app.post("/register", function(req, res){
  User.register({username: req.body.username,Name:req.body.name,
    Cash:10000,}, req.body.password, function(err, user){
    if (err) {
      console.log(err);
      res.redirect("/register");
    } else {
      passport.authenticate("local")(req, res, function(){
        res.redirect("/list");
      });
    }
  });

});

app.post("/login", function(req, res){

  const user = new User({
    username: req.body.username,
    password: req.body.password
  });

  req.login(user, function(err){
    if (err) {
      console.log(err);
    } else {
      passport.authenticate("local")(req, res, function(){
        res.redirect("/list");
      });
    }
  });

});

app.get('/list', (req, res) => {
  var url='https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=false'
    https.get(url, (resp) => {
      let data = '';
      resp.on('data', (chunk) => {
        data += chunk;
      });
      resp.on('end', () => {
          var c=JSON.parse(data)
          res.render("list",{list:c})
      });
    }).on("error", (err) => {
      console.log("Error: " + err.message);
    });
  })
  
  app.get('/list/:cname',function(req, res) {
    var bq=0;
    var x=req.params.cname;
    if(req.isAuthenticated()){
      var balance=req.user.Cash;

      var buy=req.user.Brought;
      for(var i=0;i<buy.length;i++)
      {
        if(buy[i].Crypto==x)
        bq+=buy[i].Quantity;
      }

      var sell=req.user.Sold;
      for(var i=0;i<sell.length;i++)
      {
        if(sell[i].Crypto==x)
        bq-=sell[i].Quantity;
      }
    var url='https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids='+x+'&order=market_cap_desc&per_page=100&page=1&sparkline=false'
    https.get(url, (resp) => {
      let data = '';
      resp.on('data', (chunk) => {
        data += chunk;
      });
      resp.on('end', () => {
        var c=JSON.parse(data);
        url2='https://dev-api.shrimpy.io/v1/exchanges/coinbasepro/candles?quoteTradingSymbol=USD&baseTradingSymbol=BTC&interval=1h'
        https.get(url2, (resp) => {
          let data2='';
          resp.on('data', (chunk) => {
            data2+= chunk;
          });
        
          resp.on('end', () => {
          console.log('Balance inside name is'+(balance));
          res.render('sepcur',{name:x,balance:balance,list:c,bq:bq,candle:data2});
          });
        
        }).on("error", (err) => {
          console.log("Error: " + err.message);
        });

      });
    }).on("error", (err) => {
      console.log("Error: " + err.message);
    });
  }

  else {
    res.redirect("/login");
  }
    });

  app.post('/list/:cname/buy', 
  function(req,res){
      if(req.isAuthenticated()){
      var name=req.params.cname;
      var cash=req.user.Cash;
      var Price= req.body.price;
      var amount=req.body.buyamount;
      var qty=amount/Price;
      var newcash=cash-amount;
      
      const buy= new Buy({username:req.user.username,Crypto:name,Buyprice:Price,Quantity: qty});
        buy.save();
        User.findOneAndUpdate({ username:req.user.username}, {Cash:newcash,$addToSet:{Clist:name}},{new: true },(e, founduser) => {
          founduser.Brought.push(buy);
          //founduser.Cash=Price;
          //founduser.Cash=newcash;
          //founduser.markModified('Cash');
          founduser.save();
        })
        
        alert("Brought successfully");
        var rd="/list/"+name;
        res.redirect(rd);
      }
    })

    app.post('/list/:cname/sell',function(req,res){
      if(req.isAuthenticated()){
        var cname=req.params.cname;
        var qty=req.body.sqty;
        var Price= req.body.price;
        var amount=Price*qty;
        var cash=req.user.Cash;
        var newcash=cash+amount;
        const sell= new Sell({username:req.user.username,Crypto:cname,Quantity:qty,Sellprice:Price});
        sell.save();

        User.findOneAndUpdate({username:req.user.username},{Cash:newcash},{new: true },(e, founduser) => {
          founduser.Sold.push(sell);
          //founduser.Cash=Price;
          //founduser.Cash=newcash;
          //founduser.markModified('Cash');
          founduser.save();
        })


       
      }
      alert("Sold successfully");
      var rd="/list/"+cname;
      res.redirect(rd);
    })
    
 
    app.get("/dashboard",function(req, res){
      if (req.isAuthenticated()){
        var dsh={};
        var cryplist=req.user.Clist;
        var qty=[]
        var value=[]
        var bal=req.user.Cash;
        console.log(bal)
        for(var i=0;i<cryplist.length;i++)
        { 
          dsh[cryplist[i]]=0;
        }
        var buy=req.user.Brought;
       // console.log(buy[0].Quantity);
        for(var i=0;i<buy.length;i++)
        {
          dsh[buy[i].Crypto]+=buy[i].Quantity;
        }
        var sell=req.user.Sold;
        for(var i=0;i<sell.length;i++)
        {  
          dsh[sell[i].Crypto]-=sell[i].Quantity;
        }
        for(var i=0;i<cryplist.length;i++)
        {
          qty[i]=dsh[cryplist[i]]
        }
        console.log(dsh);
        var url='https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=false'
        https.get(url, (resp) => {
          let data = '';
          resp.on('data', (chunk) => {
            data += chunk;
          });
          resp.on('end', () => {
              var list=[]
             var c=JSON.parse(data)
              //console.log(c[0].id)
              //console.log(cryplist[0])
              for(var i=0;i<cryplist.length;i++)
              {
                for(var j=0;j<c.length;j++)
                if(cryplist[i]==(c[j].id))
                {
                  list[i]=c[j].image;
                  value[i]=(c[j].current_price)*qty[i];
                  //console.log(c[j].image)
                }
              }
              res.render("dashboard",{dash:dsh,arr:cryplist,list:list,balance:bal,qlist:qty,value:value});
              //console.log(c[0].id);
          });
        }).on("error", (err) => {
          console.log("Error: " + err.message);
        });
        //console.log(dsh);
   }
       else{
         res.redirect("/login");
       }
     });
 

app.listen(3000, function() {
  console.log("Server started on port 3000.");
});


