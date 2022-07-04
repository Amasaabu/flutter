const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;
app.use(express.json());
app.post("/split-payments/compute", async (req, res, next) => {
  try {
    let unstructured = { ...req.body };
    //constraint: must not be less than 1 and be greater than 20
    if (
      unstructured.SplitInfo.length < 1 ||
      unstructured.SplitInfo.length > 20
    ) {
      const err = new Error(
        "Entries must be less than 20 and greater than one"
      );
      res.status(400).send(err.message);
      return;
    }
    //generate sum of ratio
    let sumOfRatio = 0;
    for (let index = 0; index < unstructured.SplitInfo.length; index++) {
      const element = unstructured.SplitInfo[index];
      if (element.SplitType === "RATIO") {
        sumOfRatio = sumOfRatio + element.SplitValue;
      } else {
        continue;
      }
    }
    //structuring in order of flat, percentage, ratio
    let structuredSplitInfo = [];
    let SplitResponse = [];
    let amount = unstructured.Amount;
    let sumofAllSplit = 0;
    for (let index = 0; index < unstructured.SplitInfo.length; index++) {
      const element = unstructured.SplitInfo[index];
      if (element.SplitType === "FLAT") {
        amount = amount - element.SplitValue;
        //constraint sum of all split value cannot be greater than transaction amount
        sumofAllSplit = sumofAllSplit + element.SplitValue;
        //constraint: final amount cannot be less than 0
        if (
          element.SplitValue > unstructured.Amount ||
          element.SplitValue < 0
        ) {
          const err = new Error("Split amount computed greater than T.Amount");
          res.status(400).send(err.message);
          return;
        }
        SplitResponse.push({
          SplintEntityId: element.SplitEntityId,
          Amount: element.SplitValue,
        });
      } else {
        continue;
      }
    }
    for (let index = 0; index < unstructured.SplitInfo.length; index++) {
      const element = unstructured.SplitInfo[index];
      if (element.SplitType === "PERCENTAGE") {
        const percentageValue = (element.SplitValue / 100) * amount;
        amount = amount - percentageValue;
        //constraint sum of all split value cannot be greater than transaction amount
        sumofAllSplit = sumofAllSplit + percentageValue;
        if (percentageValue > unstructured.Amount || percentageValue < 0) {
          const err = new Error("Split amount computed greater than T.Amount");
          res.status(400).send(err.message);
          return;
        }
        SplitResponse.push({
          SplintEntityId: element.SplitEntityId,
          Amount: percentageValue,
        });
      } else {
        continue;
      }
    }
    let OpeningBalanceForRatio = amount;
    for (let index = 0; index < unstructured.SplitInfo.length; index++) {
      const element = unstructured.SplitInfo[index];
      if (element.SplitType === "RATIO") {
        structuredSplitInfo.push(element);
        // sumOfRatio = sumOfRatio + element.SplitValue;

        const value = element.SplitValue;
        const result = (+value / sumOfRatio) * OpeningBalanceForRatio;
        amount = amount - result;
        //constraint sum of all split value cannot be greater than transaction amount
        sumofAllSplit = sumofAllSplit + result;
        if (result > unstructured.Amount || result < 0) {
          const err = new Error("Split amount computed greater than T.Amount");
          res.status(400).send(err.message);
          return;
        }
        SplitResponse.push({
          SplintEntityId: element.SplitEntityId,
          Amount: result,
        });
        // console.log(sumOfRatio);
      } else {
        continue;
      }
    }
    //AT THIS POINT WE HAVE ORDER RESPECTED NOW CALCULATION ON STRUCTURED SPLITINFO
    //all flat
    //for percentage
    //for ratio
    //constraint computed sum of all split values cannot be greater than the amount
    if (sumofAllSplit > unstructured.Amount) {
      const err = new Error(
        "Sum of split values greater than transaction amount"
      );
      res.status(400).send(err.message);
      return;
    }
    //constraint: final amount cannot be less than 0
    if (amount < 0) {
      const err = new Error("Entry can not be less than 0");
      res.status(400).send(err.message);
      return;
    }
    //now we order response
    let response = {
      ID: unstructured.ID,
      Balance: amount,
      SplitBreakDown: [...SplitResponse],
    };
    res.status(200).send(response);
  } catch (error) {
    console.log(error);
    res.status(500).send(error);
  }
});

app.listen(PORT, () => {
  console.log(`App is listning on port ${PORT}`);
});
