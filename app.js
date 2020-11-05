// /* CONSTANTS */
const express = require("express")
const app = express()
const PORT = 3000
const pgp = require("pg-promise")()
var bcrypt = require("bcryptjs")
const connectionString =
   "postgres://skvpwhin:lXgkojz2TanCel7pEUUSDtGg-bEKm4NW@lallah.db.elephantsql.com:5432/skvpwhin"
const db = pgp(connectionString)
const mustacheExpress = require("mustache-express")
const session = require("express-session")
const path = require('path')
const VIEWS_PATH = path.join(__dirname, './views' )
// require('dotenv').config()
/* CONSTANTS END*/


/* CREATING VIEWS */
app.use(express.urlencoded())
// app.engine("mustache", mustacheExpress())
app.engine('mustache',mustacheExpress(VIEWS_PATH + '/partials', '.mustache'))
// the pages are located in views directory
// app.set("views", "./views")
app.set('views', VIEWS_PATH)
// extension will be .mustache
app.set("view engine", "mustache")
/* CREATING VIEWS END*/

/* STATIC FILES */
app.use("/css", express.static("css"))
app.use("/client", express.static("client"))
app.use("/images", express.static("images"))
/* STATIC FILES END*/

/***************************** AUTHENTICATION STUFF ***************************** */
// initalize the session
app.use(
   session({
      secret: "keyboard cat", // this needs to be fixed
      resave: false,
      saveUnitialized: true,
   })
)
// registration page action
app.get("/register", (req, res) => {
   res.render("register")
})
// create user
app.post("/register", (req, res) => {
   // user given info
   let username = req.body.username
   let password = req.body.password
   let height = req.body.height
   let weight = req.body.weight
   // grabs all usernames, if given user exists in db, it restarts page with error message
   db.any("SELECT username FROM users").then((users) => {
      users.forEach((element) => {
         if (username != element.username) {
            bcrypt.genSalt(10, function (err, salt) {
               bcrypt.hash(password, salt, function (err, hash) {
                  db.none(
                     "INSERT INTO users(username, password, height, weight) VALUES($1,$2,$3,$4)",
                     [username, hash, height, weight]
                  ).then(() => {
                     res.redirect("/login")
                  })
               })
            })
         } else {
            res.render("register", {
               message: "Username already exists",
            })
         }
      })
   })
})
// show the login page
app.get("/login", (req, res) => {
   res.render("login")
})
// log in function, takes user data and tries to match it with username and passwords in the db
app.post("/login", (req, res) => {
   // user enters login info
   let username = req.body.username
   let password = req.body.password
   // grabs user info from db, loops through and compares to given
   db.any("SELECT username, password, user_id FROM users").then((users) => {
      users.forEach((element) => {
         if (username == element.username) {
            // uses bcrypt's compare function. result returns true if passwords match
            loggedIn = bcrypt
               .compare(password, element.password)
               .then(function (result) {
                  if (result == true) {
                     if (req.session) {
                        req.session.username = username
                        req.session.userId = element.user_id
                     }
                     res.redirect("/dashboard") // this will need to change to the dashboard
                  } else {
                     res.render("login", {
                        message: "Username or password is incorrect",
                     })
                  }
               })
         }
      })
   })
})
// logout function - destroys session and renders login screen
app.get("/logout", (req, res) => {
   req.session.destroy()
   res.render("login")
})
// authentication middleware
function authenticate(req, res, next) {
   if (req.session) {
      if (req.session.username) {
         // continue with the original request
         next()
      } else {
         res.redirect("/login")
      }
   } else {
      res.redirect("/login")
   }
}
// just a test page to see if middleware works
// app.get("/testPage", authenticate, (req, res) => {
//    let user = req.session.username
//    let uid = req.session.userId
//    res.render("test", { user: user, uid: uid})

// })
/***************************** AUTHENTICATION STUFF ***************************** */
/***************************** ROUTINE CREATOR STUFF ***************************** */

// posting the created routine to the wokouts table
app.post("/creatingRoutine", (req, res) => {
   const title = req.body.title
   const exercises = req.body.exercises.join(",")
   const user_id = req.session.userId
   
   
   db.none("INSERT INTO workouts (title, exercises, user_id) VALUES ($1, $2, $3)", [
      title,
      exercises,
      user_id
   ]).then(() => {
      res.redirect("/dashboard")
   })
})

app.post("/routineCreator/bodyPart", (req, res) => {
   const body_part = req.body.body_part

   db.any(
      "SELECT title, body_part, equipment_need FROM exercises WHERE body_part LIKE '%$1#%';",
      [body_part]
   ).then((filter) => {
      res.render("routineCreator", { allExercises: filter })
   })
})

// get request to pull the exercises
app.get("/routineCreator", (req, res) => {
   db.any("SELECT title, body_part, equipment_need FROM exercises;").then(
      (exercise) => {
         res.render("routineCreator", { allExercises: exercise })
      }
   )
})


/***************************** ROUTINE CREATOR STUFF END ***************************** */


/***************************** DASHBOARD STUFF ***************************** */
app.get("/dashboard", authenticate, async (req, res) => {
   let id = req.session.userId
              
        let userWorkouts = await db.any('SELECT user_id FROM workouts')   

        let found = userWorkouts.find(user => {
            return user.user_id == id
        })       

        if (found) {
            let result = await db.any('SELECT users.user_id, username, height, weight, age, goal, workout_id, title, exercises FROM users JOIN workouts ON users.user_id = workouts.user_id WHERE users.user_id = $1', [id])
            // let count = await db.any('SELECT COUNT (*) FROM histories WHERE user_id =$1', [id])
            let count = await getTotal(id)
            // let week = await getTotalByDate(id, 7)
            // let month = await getTotalByDate(id, 30)
            user_dashboard = getUserDetails(result, count)

            res.render('dashboard', {Dashboard: user_dashboard})
            
        } else {
            let result = await db.any('SELECT users.user_id, username, height, weight, age, goal FROM users WHERE user_id=$1', [id])
            res.render('dashboard', {Dashboard: result})
        }          
    
})


//function for getting dashboard info with workouts
function getUserDetails(result, count) {
    
    user_dashboard = []

    result.forEach((item) => {
        if (user_dashboard.length == 0)  {
            let information = {user_id: item.user_id, username: item.username, weight: item.weight, height: item.height, age: item.age, goal: item.goal, count: count, workouts: [{title: item.title, exercises: item.exercises, workout_id: item.workout_id}]}
            
            user_dashboard.push(information)
            
        } else {
            let information = user_dashboard.find(information => information.user_id == item.user_id)
            if (information) {
                information.workouts.push({title: item.title, exercises: item.exercises, workout_id: item.workout_id}) 
            } 
        }
        
    })
    return user_dashboard
}

/***************************** ROUTINES STUFF ***************************** */

/* Routines Page */
/* Display All Routines */
app.get("/routines", async (req, res) => {
   let id = req.session.userId
   db.any('SELECT workout_id, title, exercises, image FROM workouts WHERE user_id = $1', [id])
    .then(routines => {
       console.log(routines)

      
       res.render('routines', {allRoutines: routines})
   })
})

app.post("/delete-routine", (req, res) => {
    let workout_id = req.body.workout_id

    db.none('DELETE FROM workouts WHERE workout_id=$1', [workout_id])
    .then(() => {
        res.redirect('dashboard')
    })
   
})


/******************** CALC WORKOUT COUNTS FOR WEEK/MONTH FOR DASH ********************* */

// let date = new Date() need to put in history

async function getTotal(id) {
   let count = await db.any('SELECT COUNT (*) FROM histories WHERE user_id =$1', [id])
   
      return count
      
}

async function getTotalByDate(id, days) {
   let date = getDate(days)
   let countByDate = await db.any('SELECT COUNT (*) FROM histories WHERE user_id =$1', [id])
   return countByDate
      
}

function getDate(days) {
   var dateObj = new Date(); 
                           
   dateObj.setDate(dateObj.getDate() - days)

   return dateObj
}


/****************** CALC WORKOUT COUNTS FOR WEEK/MONTH FOR DASH END ********************** */
/****************** HISTORY  ********************** */
app.get("/history", async (req, res) => {
   let id = req.session.userId
   
              
        let userHistory = await db.any('SELECT user_id FROM histories')   

        let found = userHistory.find(user => {
            return user.user_id == id
        })       

        if (found) {
            let result = await db.any('SELECT histories.user_id, workouts.title, workouts.exercises, workouts.workout_id, histories.date_completed, histories_id FROM histories JOIN workouts ON histories.user_id = workouts.user_id WHERE histories.user_id = $1 ORDER BY histories_id DESC', [id])
            
            res.render('history', {History: result})
            
        } else {
            res.render('dashboard')
            
        }          
    
})

app.get("/new", (req, res)  => {

   res.render("new")
})

/****************** HISTORY END ********************** */
/***************************** DASHBOARD AND ROUTINES STUFF ***************************** */

app.post("/save", (req, res) => {
   let id = req.session.userId
   let exercises = req.body.exercises
   let title = req.body.title
   let date_completed = formatDate()
    
   db.none('INSERT INTO histories (title, user_id, exercises, date_completed) VALUES ($1, $2, $3, $4)', [title, id, exercises, date_completed])
   .then(() => {
      res.redirect('dashboard')
   })
  
})

function formatDate() {
   var d = new Date(),
       month = '' + (d.getMonth() + 1),
       day = '' + d.getDate(),
       year = d.getFullYear();

   if (month.length < 2) 
       month = '0' + month;
   if (day.length < 2) 
       day = '0' + day;

   return [year, month, day].join('-');
}

app.get("/:workout_id", (req, res) => {
   let workout_id = req.params.workout_id
   
    db.any('SELECT workout_id, title, exercises, notes FROM workouts WHERE workout_id= $1', [workout_id])
   .then(workout => {
      
      let exerciseList = workout.map((item) => {
      item.exercises = item.exercises.split(",")
      return item
   })
      res.render('workout', {exerciseList: exerciseList})
    })
})


/***************************** DASHBOARD AND ROUTINES STUFF END ***************************** */


app.listen(PORT, () => {
   console.log('Server is running...')
})
