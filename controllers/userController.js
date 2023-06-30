const User = require("../models/userModel");
const ErrorHandler = require("../utils/errorhander");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const sendToken = require("../utils/jwtToken");
const sendEmail = require("../utils/sendEmail");
const crypto = require("crypto");
const Product = require("../models/productModel");

//Register a Usr
exports.registerUser = catchAsyncErrors(async (req,res,next)=>{
    const {name,email,password} = req.body;

    const user = await User.create({
        name,
        email,
        password,
        avatar:{
            public_id:"this is a sample id",
            url: "profilePicUrl"
        }
    })

    sendToken(user,201,res);
});

//Login User
exports.loginUser = catchAsyncErrors ( async (req,res,next)=>{
    const {email , password}= req.body;

    //checking if both email and password is entered
    if(!email || !password){
        return next(new ErrorHandler("Please enter both email and password",400));
    }

    const user = await User.findOne({email}).select("+password") //cause select is given false in model
    if(!user){
        return next(new ErrorHandler("Invalid email or password",401));
    }
    
    const isPasswordMatched =await user.comparePassword(password);
    if(!isPasswordMatched){
        return next(new ErrorHandler("Invalid email or password",401));
    }

    const token = user.getJWTToken();

    sendToken(user,200,res);
})

//Logout User
exports.logout = catchAsyncErrors(async (req,res,next)=>{

    res.cookie("token",null,{
        expires:new Date(Date.now()),
        httpOnly:true,
    })

    res.status(200).json({
        success:true,
        message:"Logged Out"
    })
})

//Forgot Password
exports.forgotPassword = catchAsyncErrors(async (req,res,next)=>{
    const user = await User.findOne({email:req.body.email});

    if(!user){
        return next(new ErrorHandler("User not found",404));
    }

    //get Reset password token
    const resetToken = user.getResetPasswordToken();

    await user.save({validateBeforeSave:false});

    const resetPasswordUrl = `${req.protocol}://${req.get("host")}/api/v1/password/reset/${resetToken}`;

    const message = `Your Reset password token is :- \n\n ${resetPasswordUrl} \n\n If you haven't requested for this email, Please ignore it.`

    try {
        await sendEmail({
            email:user.email,
            subject : `Ecommerce password Recovery`,
            message,
        });

        res.status(200).json({
            success:true,
            message:`message sent to ${user.email} Successfully`
        })
        
    } catch (error) {
        user.resetPasswordToken= undefined
        user.resetPasswordExpir = undefined

        await user.save({validateBeforeSave:false});

        return next(new ErrorHandler(error.message, 500))
    }
})

//Reset Password
exports.resetPassword = catchAsyncErrors(async (req,res,next)=>{

    //creating token hash
    const resetPasswordToken = crypto.createHash("sha256").update(req.params.token).digest("hex");

    const user = await User.findOne({
        resetPasswordToken,
        resetPasswordExpire: {$gt : Date.now()},
    })

    if(!user){
        return next(new ErrorHandler("Reset password token is invalid or has been expired",400));
    }

    if(req.body.password != req.body.confirmPassword){
        return next(new ErrorHandler("password doesn't match",400));
    }

    user.password = req.body.password;

    user.resetPasswordToken= undefined
    user.resetPasswordExpir = undefined

    await user.save();

    sendToken(user,200,res);
})

// Get user detail

exports.getUserDetails = catchAsyncErrors(async (req,res,next)=>{
    const user = await User.findById(req.user.id);

    res.status(200).json({
        success:true,
        user,
    })
})

// Update User password
exports.updatePassword = catchAsyncErrors(async (req,res,next)=>{
    const user = await User.findById(req.user.id).select("+password");

    const isPasswordMatched = await user.comparePassword(req.body.oldPassword);

    if(!isPasswordMatched){
        return next(new ErrorHandler("Old password is incorrect",400))
    }

    if(req.body.newPassword != req.body.confirmPassword){
        return next (new ErrorHandler("password does not match",400))
    }

    user.password = req.body.newPassword;

    await user.save();

    sendToken(user,200,res)
})

// Update User profile
exports.updateProfile = catchAsyncErrors(async (req,res,next)=>{
    
    const newUserData = {
        name:req.body.name,
        email:req.body.email
    }

    //we will add cloudinary later

    const user = await User.findByIdAndUpdate(req.user.id,newUserData,{
        new:true,
        runValidators:true,
        useFindAndModify:false,
    })

    res.status(200).json({
        success:true
    })
})

// Get all Users (Admin)
exports.getAllUser = catchAsyncErrors(async (req,res,next)=>{
    const users = await User.find();

    res.status(200).json({
        success:true,
        users,
    })
})

// Get single User (Admin) 
exports.getSingleUser = catchAsyncErrors(async (req,res,next)=>{
    const user = await User.findById(req.params.id);

    if(!user){
        return next(new ErrorHandler(`User doesn not exist with id:${req.params.id}`,400))
    }

    res.status(200).json({
        success:true,
        user,
    })
})

// Update User Role - Admin
exports.updateUserRole = catchAsyncErrors(async (req,res,next)=>{
    
    const newUserData = {
        name:req.body.name,
        email:req.body.email,
        role:req.body.role,
    }

    const user = await User.findByIdAndUpdate(req.params.id,newUserData,{
        new:true,
        runValidators:true,
        useFindAndModify:false,
    })

    res.status(200).json({
        success:true
    })
})

// Delete User - Admin
exports.deleteUser = catchAsyncErrors(async (req,res,next)=>{

    const user = await User.findById(req.params.id)

    if(!user){
        return next(new ErrorHandler(`User does not exist with ID: ${req.params.id}`,400));
    }

    await user.deleteOne();
    
    // We will remove cloudinary later

    res.status(200).json({
        success:true,
        message:"User deleted successfully"
    })
})

// Create new Review or Update the Review
exports.createProductReview = catchAsyncErrors(async (req,res,next)=>{
    const {rating ,comment ,productId} = req.body;

    const review = {
        user:req.user._id,
        name:req.user.name,
        rating:Number(rating),
        // rating,
        comment,
    }

    const product = await Product.findById(productId);

    const isReviewed = product.reviews.find((rev)=>rev.user.toString() == req.user._id.toString());

    if(isReviewed){
        product.reviews.forEach((rev)=>{
            if(rev.user.toString() == req.user._id.toString()){
                review.rating= rating;
                review.comment = comment;
            }
        })
    }else{
        product.reviews.push(review);
        product.numOfReviews = product.reviews.length
    }

    let avg =0;
    product.reviews.forEach((rev)=>{
        avg+= rev.rating
    })
    product.ratings = avg/product.reviews.length;

    await product.save({runValidators:false});

    res.status(200).json({
        success:true
    })
})

// Get all reviews of a single product
exports.getProductReviews = catchAsyncErrors(async (req,res,next)=>{
    const product = await Product.findById(req.query.id);

    if(!product){
        return next(new ErrorHandler("Product not found",404));
    }
    
    res.status(200).json({
        success:true,
        reviews:product.reviews,
    })
})

// Delete Review
exports.deleteReview = catchAsyncErrors(async (req,res,next)=>{
    const product = await Product.findById(req.query.productId);

    if(!product){
        return next(new ErrorHandler("Product not found",404));
    }

    const reviews = product.reviews.filter((rev) => rev._id.toString() != req.query.id.toString());

    let avg =0;
    reviews.forEach((rev)=>{
        avg+= rev.rating
    })
    const ratings = avg/reviews.length;
    const numOfReviews = reviews.length;

    await Product.findByIdAndUpdate(req.query.productId,
        {reviews,ratings,numOfReviews}
        ,{
            new:true,
            runValidators:true,
            useFindAndModify:false
        }
    );

    res.status(200).json({
        success:true,
    })


})
