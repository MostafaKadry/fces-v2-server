require("dotenv").config();
const express = require("express");
const app = express(); 
const { ObjectId } = require("mongodb");
const { getDb, connectToDb } = require("./db.js");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
// const jwt_decode = require("jwt-decode");
app.use(express.json());
app.use(require("cors")());
PORT = process.env.PORT || 9000;
let db;
const waitAcception = "wait-acception";
const accepted = "accepted";
const rejected = "rejected";
const admin = "admin";
const treasury = "treasury";
connectToDb((err) => { 
  if (!err) {
    app.listen(PORT, () => console.log(`app is working on port ${PORT}`));
    db = getDb();
  }
});
const createToken = (_id) => {
  return jwt.sign({ _id }, process.env.JWT_SECRET, { expiresIn: "2d" });
};
// [1] make acception of a donation by responsibel by increase collected money and decrease remaining money
const acceptDonation = async (req, res) => {
  const donerData = req.body.donID;
  if (!donerData) return res.status(401).send("خطأ برجاء المحاولة مرة اخرى ");

  const donation = await db
    .collection("all-doners")
    .findOne({ _id: ObjectId(donerData) })
    .catch((err) => {
      res.status(500).json(err);
    });
  if (!donation) return res.status(401).send("خطأ برجاء المحاولة مرة اخرى ");
  // Number(donation.donation_val);
  parseInt(donation.donation_val);

  if (!donation.donation_val || isNaN(donation.donation_val)) {
    return res
      .status(412)
      .send(
        "هناك خطأ فى قيمة المبلغ المدفوع برجاء التواصل مع مطور الموقع فى اسرع وقت ممكن"
      );
  }
  //   increase collected money value
  const incCollected = await db
    .collection("all-money")
    .updateOne(
      { _id: ObjectId("62dbba66c30e2f1892820936") },
      { $inc: { value: parseFloat(donation.donation_val) } }
    )
    .catch((err) => res.status(504).json(err));
  // decrease remaining money value
  const decRemaing = await db
    .collection("all-money")
    .updateOne(
      { _id: ObjectId("62dbb96d54a7ca61fb02d551") },
      { $inc: { value: -donation.donation_val } }
    )
    .catch((err) => res.status(505).json(err));

  return { incCollected, decRemaing };
};
// app.post("/api/accept-donatoin", async (req, res) => {
//  acceptDonation(req, res);
// });
// get collected money
app.get("/api/collected-money", async (req, res) => {
  const { value } = await db
    .collection("all-money")
    .findOne({ _id: ObjectId("62dbba66c30e2f1892820936") })
    .catch((err) => res.status(503).json(err));
  res.status(200).json(value);
});
// get remianing money value
app.get("/api/remianing-money", async (req, res) => {
  const { value } = await db
    .collection("all-money")
    .findOne(
      { _id: ObjectId("62dbb96d54a7ca61fb02d551") },
      { projection: { value: 1 } }
    )
    .catch((err) => res.status(503).json(err));
  res.status(200).json(value);
});
// register responsible
app.post("/api/responsible", async (req, res) => {
  const responsible = req.body.donerData;
  if (!responsible) return res.status(401).send("خطأ برجاء المحاولة مرة اخرى ");
  let user = await db
    .collection("all-responsibles")
    .findOne(
      { res_email: responsible.res_email },
      { projection: { res_email: 1, _id: 0 } }
    );

  if (user) {
    return res
      .status(401)
      .send(
        " البريد الالكتروني الذي تحاول التسجيل به مُستخدَم من قبل مُستخدِِم اخر، تواصل مع مطور الموقع فى حالة الرغبة بالتسجيل بنفس البريد الالكتروني "
      );
  }
  if (
    !responsible.res_password ||
    !responsible.res_email ||
    !responsible.res_name ||
    !responsible.res_phone ||
    !responsible.helpWay
  ) {
    return res.status(402).send("لا بد من ادخال كل البيانات");
  }
  const salt = await bcrypt.genSalt(10);
  const hashed = await bcrypt.hash(responsible.res_password, salt);
  responsible.res_password = hashed;
  responsible.re_enter_res_password = hashed;
  responsible.state = waitAcception;

  db.collection("all-responsibles")
    .insertOne(responsible)
    .then((r) => {
      const token = createToken(responsible._id);
      res.status(200).json({ r: r, responsible: responsible, token: token, auth: true });
    })
    .catch((err) => res.status(503).json(err));
});
// get all responsibles to show them in register donation only in one screen
app.get("/api/responsibles", (req, res) => {
  db.collection("all-responsibles")
    .find({ state: accepted }, { projection: { res_name: 1 } })
    .toArray()
    .then((responsibles) => res.status(200).json(responsibles))
    .catch((err) => res.status(503).json(err));
});
// get all responsibles to show them for Admin
app.get("/api/show-admin-theresponsibles", (req, res) => {
  db.collection("all-responsibles")
    .find(
      {},
      {
        projection: {
          res_password: 0,
          re_enter_res_password: 0,
        },
      }
    )
    .toArray()
    .then((responsibles) => res.status(200).json(responsibles))
    .catch((err) => res.status(503).json(err));
});
// sign in responsible
app.post("/api/sign-responsible", async (req, res) => {
  const { resData } = req.body;
  if (!resData) return res.status(402).send("خطأ برجاء المحاولة مرة اخرى ");
  if (resData.res_password && resData.res_email) {
    const resDB = await db
      .collection("all-responsibles")
      .findOne({ res_email: resData.res_email });
    if (resDB) {
      const isMatch = await bcrypt.compare(
        resData.res_password,
        resDB.res_password
      );
      if (!isMatch)
        return res
          .status(401)
          .send(
            `الرقم السري خطأ | فى حالة نسيان الرقم السري تواصل مع مطور الموقع`
          );
      if (resDB.logedin === true)
        return res.status(401).send("قم بتسجيل الخروج من الاجهزة الاخرى ");
      if (resDB.state === waitAcception)
        return res.status(401).send("لم يتم تفعيل الحساب بعد");
      if (resDB.state === rejected)
        return res.status(401).send("لقد تم رفض طلبك ");
      if (
        resDB.state === accepted ||
        resDB.state === admin ||
        resDB.state === treasury
      ) {
        //   db.collection("all-responsibles").updateOne(
        //   { _id: ObjectId(resDB._id) },
        //   { $set: { logedin: true } }
        // );
        const token = createToken(resDB._id);
        let nextUrl = "";
        const resDBID = resDB._id.toString();
        // admin way: mostafa kadry id
        if (resDBID === "62e90db174361fe58938ac68") {
          nextUrl = "/fces-donation-system/#/admin-dashbord";
        }
        // treasury way: medhat elkady id
        else if (resDB.state === treasury) {
          nextUrl = "/fces-donation-system/#/treasury";
        } else {
          nextUrl = "/fces-donation-system/#/res-dashbord";
        }

        return res
          .status(200)
          .json({ responsibele_ID: resDB._id, token, nextUrl, auth: true });
      }
    } else {
      res
        .status(405)
        .send({msg: `البريد الالكتروني الذي تحاول تسجيل الدخول به غير موجود`, auth: false});
    }
  } else {
    res.status(401).send({msg: "برجاء ادخال جميع البيانات بشكل صحيح" , auth: flase});
  }
});
// logout responsible
app.post("/api/logout-responsible", (req, res) => {
  const { resID } = req.body;
  if (!resID) return res.status(401).send("خطأ برجاء المحاولة مرة اخرى ");
  db.collection("all-responsibles")
    .updateOne({ _id: ObjectId(resID) }, { $set: { logedin: false } })
    .then((r) => {
      res.status(200).json(r);
    })
    .catch((err) => res.status(503).json(err));
});
// get doners requests
app.get("/api/doners-requests", (req, res) => {
  let token = req.headers['x-access-token'];
  let responsibele_ID;
  if (!token) return res.status(401).send({ auth: false, message: 'No token provided.' });
   jwt.verify(token, process.env.JWT_SECRET, function(err, decoded) {
    if (err) return res.status(500).send({ auth: false, message: 'Failed to authenticate token.' });
    // res.status(200).send(decoded);
    responsibele_ID = decoded._id;
  });
  // const { responsibele_ID } = req.query;
  if (!responsibele_ID)
    return res.status(401).send("خطأ برجاء المحاولة مرة اخرى ");
  let donerReq = [];
  // treasury data : medhat
  if (
    responsibele_ID === "6340b786fceb66646db1903a" ||
    responsibele_ID === "6346a6606032470b610bca68"
  ) {
    db.collection("all-doners")
      .find({ sentToTreasury: true })
      .forEach((r) => donerReq.push(r))
      .then(() => res.status(200).json(donerReq))
      .catch((err) => res.status(503).json(err));

    return;
  }
  // admin dash bord : mostafa kadry
  else if (responsibele_ID === "62e90db174361fe58938ac68") {
    db.collection("all-doners")
      .find()
      .forEach((r) => donerReq.push(r))
      .then(() => res.status(200).json(donerReq))
      .catch((err) => res.status(503).json(err));

    return;
  }
  // responsible data
  else {
    db.collection("all-doners")
      .find({ responsibele_ID: responsibele_ID })
      .forEach((r) => donerReq.push(r))
      .then(() => res.status(200).json(donerReq))
      .catch((err) => res.status(503).json(err));
    return;
  }
});
// register donation
app.post("/api/register-donation", async (req, res) => {
  const { donerData } = req.body;
  let isResExist;
  if (!donerData) return res.status(401).send("خطأ برجاء المحاولة مرة اخرى ");
  console.log(donerData.responsibele_ID);
  isResExist = await db.collection("all-responsibles").findOne(
    {
      _id: ObjectId(donerData.responsibele_ID),
    },
    { projection: { res_email: 1 } }
  );
  if (!isResExist) {
    console.log(isResExist);
    return res.status(405).json({ text: "خطأ" });
  }
  const saveDonerData = await db
    .collection("all-doners")
    .insertOne(donerData)
    .catch((err) => res.status(506).json(err));
  res.status(200).json(saveDonerData);
});
// accept doners by responsible
app.post("/api/accept-donation", async (req, res) => {
  const donerID = req.body.donID;
  if (!donerID) return res.status(401).send("!خطأ برجاء المحاولة مرة اخرى ");
  const acceptByRes = await db
    .collection("all-doners")
    .updateOne(
      { _id: ObjectId(donerID) },
      { $set: { accepted: true, denied: false } }
    )
    .catch((err) => {
      res.status(405).send(err);
    });
  await acceptDonation(req, res);
  res.status(200).json(acceptByRes);
});
// deny doner requests by responsible
app.post("/api/deny-donation", (req, res) => {
  const donerID = req.body.donID;
  if (!donerID) return res.status(401).send("!خطأ برجاء المحاولة مرة اخرى ");
  db.collection("all-doners")
    .updateOne(
      { _id: ObjectId(donerID) },
      { $set: { accepted: false, denied: true } }
    )
    .then((response) => {
      res.status(200).send(response);
    })
    .catch((err) => {
      res.status(405).send(err);
    });
});
// back to waitAcception donations
// app.post("/api/back-to-requested-donation", (req, res) => {
//   const donerID = req.body.donID;
//   if (!donerID) return res.status(401).send("خطأ برجاء المحاولة مرة اخرى ");
//   db.collection("all-doners")
//     .updateOne(
//       { _id: ObjectId(donerID) },
//       { $set: { accepted: false, denied: false } }
//     )
//     .then((response) => {
//       res.status(200).send(response);
//     })
//     .catch((err) => {
//       res.status(405).send(err);
//     });
// });
// send to treasury by responsible
app.post("/api/send-to-tresury-by-res", (req, res) => {
  const donerID = req.body.donID;
  if (!donerID) return res.status(401).send("خطأ برجاء المحاولة مرة اخرى ");
  const sentToTreasuryDate = new Date().toLocaleDateString();
  const sentToTreasuryTime = new Date().toLocaleTimeString();

  db.collection("all-doners")
    .updateOne(
      { _id: ObjectId(donerID) },
      {
        $set: {
          accepted: true,
          denied: false,
          sentToTreasury: true,
          acceptedByTreasury: false,
          deniedByTreasury: false,
          sentToTreasuryDate,
          sentToTreasuryTime,
        },
      }
    )
    .then((response) => {
      res.status(200).send(response);
    })
    .catch((err) => {
      res.status(405).send(err);
    });
});
app.post("/api/accept-responsabile-by-treasury", async (req, res) => {
  const donerID = req.body.donID;
  if (!donerID) return res.status(401).send("!خطأ برجاء المحاولة مرة اخرى ");

  try {
    const donatoinToTreasury = await db
      .collection("all-doners")
      .findOneAndUpdate(
        { _id: ObjectId(donerID) },
        {
          $set: {
            acceptedByTreasury: true,
            deniedByTreasury: false,
            acceptedByTreasuryDate: new Date().toLocaleDateString(),
            acceptedByTreasuryTime: new Date().toLocaleTimeString(),
          },
        },
        { upsert: true, returnDocument: "after" }
      );
    if (donatoinToTreasury.value) {
      const inserted = await db
        .collection("donations-in-treasury")
        .insertOne(donatoinToTreasury.value);
      return res.status(200).json({ donatoinToTreasury, inserted });
    } else {
      return res
        .status(401)
        .send("هناك خطا ما الرجاء التواصل مع مطور الموقع فورا");
    }
  } catch (error) {
    res.status(405).send(error);
  }
});
// deny by treasury
app.post("/api/deny-responsabile-by-treasury", async (req, res) => {
  const donerID = req.body.donID;
  if (!donerID) return res.status(401).send("خطأ برجاء المحاولة مرة اخرى ");
  try {
    const donatoinToTreasury = await db
      .collection("all-doners")
      .findOneAndUpdate(
        { _id: ObjectId(donerID) },
        {
          $set: {
            acceptedByTreasury: false,
            deniedByTreasury: true,
            deniedByTreasuryDate: new Date().toLocaleDateString(),
            deniedByTreasuryTime: new Date().toLocaleTimeString(),
          },
        },
        { upsert: true, returnDocument: "after" }
      );
    if (donatoinToTreasury.value) {
      return res.status(200).json({ donatoinToTreasury });
    }
  } catch (error) {
    res.status(405).send(error);
  }
});
app.post("/api/delete-one", async (req, res) => {
  const { donerID } = req.body;
  const { collectionName } = req.body;
  if (!donerID) return res.status(401).send("!!خطأ برجاء المحاولة مرة اخرى ");
  db.collection(collectionName)
    .deleteOne({ _id: ObjectId(donerID) })
    .then((response) => {
      res.status(200).send(response);
    })
    .catch((err) => {
      res.status(405).send(err);
    });
});
app.use(express.static("client/build"));
app.get("*", (req, res) => {
  res.sendFile(`${__dirname}/client/build/index.html`);
});
