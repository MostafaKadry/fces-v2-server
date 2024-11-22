const { MongoClient } = require("mongodb");
let database;
const url = `mongodb+srv://${process.env.DBN}:${process.env.DBP}@faculty-project.4f45z.mongodb.net/faculty-project?retryWrites=true&w=majority`;
module.exports = {
  connectToDb: (cb) => {
    MongoClient.connect(url)
      .then((client) => {
        database = client.db();
        return cb();
      })
      .catch((err) => {
        console.log(err); 
        return cb(err);
      });
  },
  getDb: () => database,
};
