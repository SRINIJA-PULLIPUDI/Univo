require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const User = require('./models/User');
  const Branch = require('./models/Branch');

  const branches = await Branch.find();
  console.log('Branches count:', branches.length);
  for (const b of branches) {
    const students = await User.countDocuments({ branch: b._id, role: 'student', isActive: true, isAlumni: { $ne: true } });
    const faculty = await User.countDocuments({ branch: b._id, role: { $in: ['faculty', 'hod'] }, isActive: true });
    console.log('Branch:', b.code, b.name, 'Students:', students, 'Faculty:', faculty);
    for (let y = 1; y <= 4; y++) {
      const yCount = await User.countDocuments({ branch: b._id, role: 'student', year: y, isActive: true, isAlumni: { $ne: true } });
      const mCount = await User.countDocuments({ branch: b._id, role: 'student', year: y, gender: 'Male', isActive: true, isAlumni: { $ne: true } });
      const fCount = await User.countDocuments({ branch: b._id, role: 'student', year: y, gender: 'Female', isActive: true, isAlumni: { $ne: true } });
      console.log('  Year', y, 'Total:', yCount, 'Male:', mCount, 'Female:', fCount);
    }
  }

  const allStudents = await User.countDocuments({ role: 'student', isActive: true, isAlumni: { $ne: true } });
  const allUsers = await User.find().select('name role branch year email');
  console.log('Total active non-alumni students in DB:', allStudents);
  console.log('Total users in DB:', allUsers.length);
  allUsers.forEach(u => console.log('User:', u.email, '| Role:', u.role, '| Year:', u.year, '| Branch:', u.branch));

  process.exit(0);
});
