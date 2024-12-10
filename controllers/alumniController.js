import { catchAsyncError } from "../middlewares/catchAsyncError.js";
import ErrorHandler from "../utils/errorHandler.js";
import { Alumni } from "../models/alumniModel.js";
import { User } from "../models/userModel.js";
import ApiFeatures from "../utils/apiFeatures.js";
import cloudinary from "cloudinary";
import { JobPortal } from "../models/jobPortalModel.js";
import getDataUri from "../utils/dataUri.js";
import { sendToken } from "../utils/sendToken.js";
import { sendEmail } from "../utils/sendEmail.js";


export const alumniRegister = catchAsyncError(async (req, res, next) => {
    const { firstName, lastName, email, password, dateOfBirth = "unknown", role = "alumni", graduationYear = "unknown", fieldOfStudy = "unknown", profession = "unknown", industry = "unknown", jobLocation = "unknown", linkedin = "unknown", github = "unknown", twitter = "unknown", instagram = "unknown", portfolio = "unknown" } = req.body;

    const alreadyExist = await Alumni.findOne({ email: email });

    if (alreadyExist) {
        return next(new ErrorHandler("You are already registered as an Alumni", 400));
    }

    const file = req.file;
    if (!file) {
        return next(new ErrorHandler('Please upload an image file', 400));
    }

    const fileUri = getDataUri(file);
    const mycloud = await cloudinary.v2.uploader.upload(fileUri.content);

    const newUser = await Alumni.create({
        firstName,
        lastName,
        email,
        role,
        graduationYear,
        fieldOfStudy,
        profession,
        industry,
        jobLocation,
        password,
        socialMedia: { linkedin, github, twitter, instagram, portfolio },
        profilePic: { public_id: mycloud.public_id, url: mycloud.secure_url },
        dateOfBirth,
    });

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="text-align: center;">
          <img src="https://nosplan.in/wp-content/uploads/2022/06/87202-746-7461236_gautam-buddha-university-logo-png-transparent-png.png" alt="Institution Logo" style="max-width: 200px; margin-bottom: 20px;" />
        </div>
        <h1 style="text-align: center; color: #4CAF50;">Welcome to the Alumni Network!</h1>
        <p>Dear <strong>${newUser.firstName} ${newUser.lastName}</strong>,</p>
        <p>We are thrilled to have you join our alumni community. As a valued member, you can connect, collaborate, and grow with fellow alumni. Stay updated on events, opportunities, and news from our network.</p>
        <p><strong>Your Profile Highlights:</strong></p>
        <ul>
          <li><strong>Graduation Year:</strong> ${graduationYear}</li>
          <li><strong>Field of Study:</strong> ${fieldOfStudy}</li>
          <li><strong>Current Profession:</strong> ${profession}</li>
        </ul>
        <p>You can now <a href="https://alumni-network-login-url.com" style="color: #4CAF50; text-decoration: none;">login</a> to your account and start connecting with other alumni.</p>
        <p style="text-align: center;">Best Regards,<br /><strong>Your Alumni Team</strong></p>
        <footer style="margin-top: 20px; text-align: center; font-size: 0.8em; color: #555;">
          <p>Contact us: support@institution.com | +123-456-7890</p>
          <p>&copy; 2024 Institution Name. All rights reserved.</p>
        </footer>
      </div>
    `;

    await sendEmail(newUser.email, "Welcome to Alumni Network", null, htmlContent);

    sendToken(res, newUser, `Alumni Registered Successfully`, 201);
});


export const alumniLogin = catchAsyncError(async (req, res, next) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return next(new ErrorHandler("Please enter email & password", 400));
    }

    const alumniUser = await Alumni.findOne({ email }).select("+password");
    // console.log({ alumniUser });

    if (!alumniUser) {
        return next(new ErrorHandler("Invalid Email or Password", 401));
    }

    const isPasswordMatched = await alumniUser.comparePassword(password);

    if (!isPasswordMatched) {
        return next(new ErrorHandler("Invalid Email or Password", 401));
    }

    sendToken(res, alumniUser, `Welcome back, ${alumniUser.firstName}`, 200);

});

export const alumniLogout = catchAsyncError(async (req, res, next) => {
    console.log("in the alumni logout")
    res
        .status(200)
        .cookie("token", null, {
            expires: new Date(Date.now()),
            httpOnly: true,
            secure: true,
            sameSite: "none",
        })
        .json({
            success: true,
            message: "Logged Out Successfully",
            isAlumniAuthenticated: false,
        });
});


export const loadAlumniDetails = catchAsyncError(async (req, res, next) => {
    const alumni = await Alumni.findById(req.user.id);
    if (!alumni) {
        return next(new ErrorHandler("Alumni not found", 404));
    }

    res.status(200).json({
        success: true,
        alumni,
    });
});

export const getAlumni = catchAsyncError(async (req, res, next) => {
    const resultPerPage = 10;
    const alumniCount = await Alumni.countDocuments();
    const apiFeatures = new ApiFeatures(Alumni.find(), req.query).search().filter();
    const allAlumni = await apiFeatures.query;
    const reversedAlumnis = allAlumni.reverse();
    let filteredAlumni = reversedAlumnis.length;
    let filteredAlumniCount = reversedAlumnis.length;

    // Pagination 
    const page = Number(req.query.page) || 1;
    const startIndex = (page - 1) * resultPerPage;
    const endIndex = page * resultPerPage;
    const paginatedAlumni = reversedAlumnis.slice(startIndex, endIndex);

    res.status(200).json({
        success: true,
        alumnis: paginatedAlumni,
        alumniCount,
        resultPerPage,
        filteredAlumni,
        filteredAlumniCount,
    });
});

export const deleteAlumni = catchAsyncError(async (req, res, next) => {
    const alumni = await Alumni.findById(req.params.id);
    // console.log({ alumni });

    if (!alumni) {
        return next(new ErrorHandler("Alumni not found", 404));
    }
    const jobPosted = await JobPortal.find({ createdBy: alumni.user });

    await JobPortal.deleteMany({ createdBy: alumni.user });

    const user = await User.findOne({ email: alumni.email });

    if (!user) {
        await cloudinary.v2.uploader.destroy(alumni.profilePic.public_id);
        await Alumni.findByIdAndDelete(req.params.id);
        return next(new ErrorHandler("User is a Alumni but record not exist in data base deleting completely", 404));
    }

    await cloudinary.v2.uploader.destroy(alumni.profilePic.public_id);

    await cloudinary.v2.uploader.destroy(user.profilePic.public_id);

    await Alumni.findByIdAndDelete(req.params.id);

    await User.findByIdAndDelete(user._id);

    res.status(200).json({
        success: true,
        message: "Alumni Deleted Successfully",
    });
});

export const getAlumniDetails = catchAsyncError(async (req, res, next) => {
    const alumni = await Alumni.findById(req.params.id);

    if (!alumni) {
        return next(new ErrorHandler("Alumni not found", 404));
    }

    res.status(200).json({
        success: true,
        alumni,
    });
});

// sachin 