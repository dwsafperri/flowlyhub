import express from 'express';
import mongoose from 'mongoose';
import { authenticateToken } from '../middleware/auth.js';
import { getAttendanceData, getEmployeeData } from '../utils/csvReader.js';

const router = express.Router();

// Attendance schema
const attendanceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  clockIn: {
    type: Date,
    required: true
  },
  clockOut: {
    type: Date,
    default: null
  },
  workHours: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['present', 'late', 'absent', 'half-day'],
    default: 'present'
  },
  notes: {
    type: String,
    default: ''
  },
  location: {
    latitude: Number,
    longitude: Number,
    address: String
  }
}, {
  timestamps: true
});

// Index for better performance
attendanceSchema.index({ userId: 1, date: 1 });
attendanceSchema.index({ date: 1 });

const Attendance = mongoose.model('Attendance', attendanceSchema);

// Clock in
router.post('/clock-in', authenticateToken, async (req, res) => {
  try {
    const { location, notes } = req.body;
    const userId = req.user.userId;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if already clocked in today
    const existingAttendance = await Attendance.findOne({
      userId,
      date: { $gte: today, $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000) }
    });

    if (existingAttendance) {
      return res.status(400).json({
        success: false,
        message: 'Already clocked in today'
      });
    }

    // Determine status based on time
    const clockInTime = new Date();
    const workStartTime = new Date();
    workStartTime.setHours(9, 0, 0, 0); // 9:00 AM

    let status = 'present';
    if (clockInTime > workStartTime) {
      const lateMinutes = (clockInTime - workStartTime) / (1000 * 60);
      status = lateMinutes > 30 ? 'late' : 'present';
    }

    const attendance = new Attendance({
      userId,
      date: today,
      clockIn: clockInTime,
      status,
      notes: notes || '',
      location
    });

    await attendance.save();
    await attendance.populate('userId', 'name email');

    res.status(201).json({
      success: true,
      message: 'Clocked in successfully',
      data: attendance
    });
  } catch (error) {
    console.error('Clock in error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clock in',
      error: error.message
    });
  }
});

// Clock out
router.post('/clock-out', authenticateToken, async (req, res) => {
  try {
    const { notes } = req.body;
    const userId = req.user.userId;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find today's attendance record
    const attendance = await Attendance.findOne({
      userId,
      date: { $gte: today, $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000) },
      clockOut: null
    });

    if (!attendance) {
      return res.status(400).json({
        success: false,
        message: 'No clock-in record found for today'
      });
    }

    const clockOutTime = new Date();
    const workHours = (clockOutTime - attendance.clockIn) / (1000 * 60 * 60);

    attendance.clockOut = clockOutTime;
    attendance.workHours = Math.round(workHours * 100) / 100;
    attendance.notes = notes ? `${attendance.notes} | Clock-out: ${notes}` : attendance.notes;

    // Update status if half day
    if (workHours < 4) {
      attendance.status = 'half-day';
    }

    await attendance.save();
    await attendance.populate('userId', 'name email');

    res.json({
      success: true,
      message: 'Clocked out successfully',
      data: attendance
    });
  } catch (error) {
    console.error('Clock out error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clock out',
      error: error.message
    });
  }
});

// CSV DATA ROUTES (NO AUTH REQUIRED) - Must be before general routes
// Get attendance data from CSV
router.get('/csv-data', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      startDate, 
      endDate,
      employeeId,
      weather
    } = req.query;

    // Get all attendance data from CSV
    const attendanceData = await getAttendanceData();
    
    // Filter data based on query parameters
    let filteredData = attendanceData;
    
    if (startDate && endDate) {
      filteredData = filteredData.filter(record => {
        const recordDate = new Date(record.tanggal);
        const start = new Date(startDate);
        const end = new Date(endDate);
        return recordDate >= start && recordDate <= end;
      });
    }
    
    if (employeeId) {
      filteredData = filteredData.filter(record => 
        record.id_karyawan === parseInt(employeeId)
      );
    }
    
    if (weather) {
      filteredData = filteredData.filter(record => 
        record.cuaca.toLowerCase() === weather.toLowerCase()
      );
    }

    // Pagination
    const totalRecords = filteredData.length;
    const totalPages = Math.ceil(totalRecords / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedData = filteredData.slice(startIndex, endIndex);

    res.json({
      success: true,
      data: paginatedData,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalRecords,
        hasNext: parseInt(page) < totalPages,
        hasPrev: parseInt(page) > 1
      }
    });
  } catch (error) {
    console.error('Error fetching CSV attendance data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch attendance data',
      error: error.message
    });
  }
});

// Get attendance statistics from CSV
router.get('/stats', async (req, res) => {
  try {
    const attendanceData = await getAttendanceData();
    
    const totalRecords = attendanceData.length;
    const onTimeRecords = attendanceData.filter(record => record.terlambat === 0).length;
    const lateRecords = attendanceData.filter(record => record.terlambat === 1).length;
    
    // Weather statistics
    const weatherStats = {};
    attendanceData.forEach(record => {
      if (!weatherStats[record.cuaca]) {
        weatherStats[record.cuaca] = {
          count: 0,
          lateCount: 0
        };
      }
      weatherStats[record.cuaca].count++;
      if (record.terlambat === 1) {
        weatherStats[record.cuaca].lateCount++;
      }
    });
    
    // Calculate percentages
    Object.keys(weatherStats).forEach(weather => {
      const stats = weatherStats[weather];
      stats.latePercentage = Math.round((stats.lateCount / stats.count) * 100);
    });
    
    // Employee statistics
    const employeeStats = {};
    attendanceData.forEach(record => {
      if (!employeeStats[record.id_karyawan]) {
        employeeStats[record.id_karyawan] = {
          name: record.nama_karyawan,
          totalAttendance: 0,
          lateCount: 0
        };
      }
      employeeStats[record.id_karyawan].totalAttendance++;
      if (record.terlambat === 1) {
        employeeStats[record.id_karyawan].lateCount++;
      }
    });

    res.json({
      success: true,
      data: {
        summary: {
          totalRecords,
          onTimeRecords,
          lateRecords,
          onTimePercentage: Math.round((onTimeRecords / totalRecords) * 100),
          latePercentage: Math.round((lateRecords / totalRecords) * 100)
        },
        weatherStats,
        employeeStats: Object.entries(employeeStats).map(([id, stats]) => ({
          id: parseInt(id),
          name: stats.name,
          totalAttendance: stats.totalAttendance,
          lateCount: stats.lateCount,
          latePercentage: Math.round((stats.lateCount / stats.totalAttendance) * 100)
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching attendance stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch attendance statistics',
      error: error.message
    });
  }
});

// Get employees list from CSV data
router.get('/employees', async (req, res) => {
  try {
    const employees = await getEmployeeData();
    
    res.json({
      success: true,
      data: employees
    });
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch employees',
      error: error.message
    });
  }
});

// Get attendance records
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      userId, 
      startDate, 
      endDate, 
      status 
    } = req.query;

    // Build filter
    const filter = {};
    
    // If not admin/manager, only show own records
    if (!['admin', 'manager'].includes(req.user.role)) {
      filter.userId = req.user.userId;
    } else if (userId) {
      filter.userId = userId;
    }

    if (startDate && endDate) {
      filter.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    if (status) {
      filter.status = status;
    }

    // Execute query with pagination
    const attendances = await Attendance.find(filter)
      .populate('userId', 'name email')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ date: -1 });

    const total = await Attendance.countDocuments(filter);

    // Calculate statistics
    const stats = await Attendance.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalRecords: { $sum: 1 },
          totalWorkHours: { $sum: '$workHours' },
          presentDays: {
            $sum: {
              $cond: [{ $eq: ['$status', 'present'] }, 1, 0]
            }
          },
          lateDays: {
            $sum: {
              $cond: [{ $eq: ['$status', 'late'] }, 1, 0]
            }
          },
          absentDays: {
            $sum: {
              $cond: [{ $eq: ['$status', 'absent'] }, 1, 0]
            }
          }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        attendances,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        },
        stats: stats[0] || {
          totalRecords: 0,
          totalWorkHours: 0,
          presentDays: 0,
          lateDays: 0,
          absentDays: 0
        }
      }
    });
  } catch (error) {
    console.error('Get attendance error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch attendance records',
      error: error.message
    });
  }
});

// Get attendance by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const attendance = await Attendance.findById(req.params.id)
      .populate('userId', 'name email');
    
    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: 'Attendance record not found'
      });
    }

    // Check if user can access this record
    if (!['admin', 'manager'].includes(req.user.role) && 
        attendance.userId._id.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this record'
      });
    }

    res.json({
      success: true,
      data: attendance
    });
  } catch (error) {
    console.error('Get attendance error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch attendance record',
      error: error.message
    });
  }
});

// Update attendance (admin/manager only)
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    if (!['admin', 'manager'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update attendance records'
      });
    }

    const { status, notes, clockIn, clockOut } = req.body;
    const updateData = {};

    if (status) updateData.status = status;
    if (notes) updateData.notes = notes;
    if (clockIn) updateData.clockIn = new Date(clockIn);
    if (clockOut) updateData.clockOut = new Date(clockOut);

    // Recalculate work hours if times are updated
    if (updateData.clockIn || updateData.clockOut) {
      const attendance = await Attendance.findById(req.params.id);
      if (attendance) {
        const clockInTime = updateData.clockIn || attendance.clockIn;
        const clockOutTime = updateData.clockOut || attendance.clockOut;
        
        if (clockInTime && clockOutTime) {
          updateData.workHours = Math.round(
            (clockOutTime - clockInTime) / (1000 * 60 * 60) * 100
          ) / 100;
        }
      }
    }

    const attendance = await Attendance.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate('userId', 'name email');

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: 'Attendance record not found'
      });
    }

    res.json({
      success: true,
      message: 'Attendance record updated successfully',
      data: attendance
    });
  } catch (error) {
    console.error('Update attendance error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update attendance record',
      error: error.message
    });
  }
});

// Delete attendance (admin only)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can delete attendance records'
      });
    }

    const attendance = await Attendance.findByIdAndDelete(req.params.id);
    
    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: 'Attendance record not found'
      });
    }

    res.json({
      success: true,
      message: 'Attendance record deleted successfully'
    });
  } catch (error) {
    console.error('Delete attendance error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete attendance record',
      error: error.message
    });
  }
});

// Get today's status
router.get('/today/status', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const attendance = await Attendance.findOne({
      userId,
      date: { $gte: today, $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000) }
    });

    res.json({
      success: true,
      data: {
        hasClockIn: !!attendance,
        hasClockOut: attendance ? !!attendance.clockOut : false,
        attendance: attendance || null
      }
    });
  } catch (error) {
    console.error('Get today status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get today\'s status',
      error: error.message
    });
  }
});

export default router;
