"use strict";

class ValidationError extends Error {
  constructor(message, fieldId = null) {
    super(message);
    this.name = "ValidationError";
    this.fieldId = fieldId;
  }
}

function validateInput(fieldId, value) {
  if (fieldId === "principal") {
    if (!Number.isFinite(value) || value < 0.01) {
      throw new ValidationError("Enter a loan principal of at least $0.01.", fieldId);
    }
    // Compare dollar amounts after rounding to avoid rejecting values such as 0.29.
    if (value !== Math.round(value * 100) / 100) {
      throw new ValidationError("Enter a loan principal in whole cents (for example, 100.25).", fieldId);
    }
  }
  if (fieldId === "annual-rate" && (!Number.isFinite(value) || value < 0)) {
    throw new ValidationError("Enter an annual interest rate of zero or greater.", fieldId);
  }
  if (fieldId === "months" && (!Number.isSafeInteger(value) || value <= 0)) {
    throw new ValidationError("Enter a loan term as a whole number of months greater than zero.", fieldId);
  }
}

// Calculate a fixed-rate loan using the unrounded monthly payment.
function calculateLoan(principal, annualRate, months) {
  validateInput("principal", principal);
  validateInput("annual-rate", annualRate);
  validateInput("months", months);

  const monthlyRate = annualRate / 100 / 12;
  // log1p and expm1 preserve precision when the interest rate is very small.
  const monthlyPayment = monthlyRate === 0
    ? principal / months
    : principal * monthlyRate / -Math.expm1(-months * Math.log1p(monthlyRate));
  const totalRepayment = monthlyPayment * months;

  if (!Number.isFinite(monthlyPayment) || !Number.isFinite(totalRepayment)) {
    throw new ValidationError("These values are too large to calculate. Enter smaller values.");
  }
  return { monthlyPayment, totalRepayment };
}

const form = document.getElementById("loan-form");
const error = document.getElementById("error");
const results = document.getElementById("results");
const announcement = document.getElementById("announcement");
const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
let invalidField = null;

function clearError() {
  if (invalidField) {
    invalidField.removeAttribute("aria-invalid");
    invalidField.removeAttribute("aria-describedby");
    invalidField = null;
  }
  error.hidden = true;
  error.textContent = "";
}

function showError(problem) {
  if (problem instanceof ValidationError) {
    error.textContent = problem.message;
    error.hidden = false;
    if (problem.fieldId) {
      invalidField = document.getElementById(problem.fieldId);
      invalidField.setAttribute("aria-invalid", "true");
      invalidField.setAttribute("aria-describedby", "error");
      invalidField.focus();
    }
  } else {
    console.error("Loan calculation failed:", problem);
    error.textContent = "Something went wrong while calculating your payment. Please try again.";
    error.hidden = false;
  }
}

form.addEventListener("input", function (event) {
  results.hidden = true;
  announcement.textContent = "";
  if (!invalidField) {
    clearError();
  } else if (event.target === invalidField) {
    try {
      validateInput(invalidField.id, invalidField.valueAsNumber);
      clearError();
    } catch (problem) {
      if (problem instanceof ValidationError) {
        error.textContent = problem.message;
      } else {
        showError(problem);
      }
    }
  }
});
form.addEventListener("submit", function (event) {
  event.preventDefault();
  results.hidden = true;
  clearError();
  try {
    const principal = document.getElementById("principal").valueAsNumber;
    const annualRate = document.getElementById("annual-rate").valueAsNumber;
    const months = document.getElementById("months").valueAsNumber;
    const payment = calculateLoan(principal, annualRate, months);
    document.getElementById("monthly-payment").textContent = currency.format(payment.monthlyPayment);
    document.getElementById("total-repayment").textContent = currency.format(payment.totalRepayment);
    results.hidden = false;
    announcement.textContent = `Estimated monthly payment: ${currency.format(payment.monthlyPayment)}. Total repayment: ${currency.format(payment.totalRepayment)}.`;
  } catch (problem) {
    announcement.textContent = "";
    showError(problem);
  }
});
