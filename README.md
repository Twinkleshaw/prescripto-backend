# 🏥 Prescripto Backend

Backend API for a clinic/appointment booking system built with **Node.js, Express, and MongoDB**.

---

## 🚀 Features

### 👤 Patient

* Register/Login
* Update profile (except phone number)
* View appointments
* Cancel appointments

### 👨‍⚕️ Doctor

* Manage appointments
* Mark appointments as completed

### 🛠️ Admin

* Manage doctors
* Deactivate (delete) doctors
* View all appointments

---


## 🧠 Business Logic Highlights

* Phone number cannot be updated after registration
* Appointment slots are generated using token system
* Role-based access control (Admin, Doctor, Patient)
* Soft delete used for doctors (`isActive = false`)
* Appointment status flow:

  * `booked → cancelled`
  * `booked → completed`

---

## ⚠️ Important Notes

* `.env` file should not be committed
* Use MongoDB locally or Atlas
* Use Postman for testing APIs

---

## 🔥 Future Improvements

* Reschedule appointment
* Payment integration
* OTP (SMS/WhatsApp)
* File upload (profile image)

---

## 👨‍💻 Author

Twinkle Shaw

---

## ⭐ If you like this project

Give it a ⭐ on GitHub!
