export const studentTutors = [
  {
    id: 'minh-anh',
    name: 'Nguyen Minh Anh',
    shortName: 'Minh Anh',
    subjects: 'Mathematics • Physics',
    mobileSubjects: 'Mathematics',
    rating: '4.9',
    reviews: '126 reviews',
    price: '150,000₫',
    mobilePrice: '150k',
    image: '/assets/figma/student-tutor-3.jpg',
  },
  {
    id: 'thu-ha',
    name: 'Tran Thu Ha',
    shortName: 'Thu Ha',
    subjects: 'English • IELTS',
    mobileSubjects: 'English • IELTS',
    rating: '4.8',
    reviews: '105 reviews',
    price: '180,000₫',
    mobilePrice: '180k',
    image: '/assets/figma/student-tutor-2.jpg',
  },
  {
    id: 'quang-huy',
    name: 'Le Quang Huy',
    shortName: 'Quang Huy',
    subjects: 'Chemistry • Biology',
    mobileSubjects: 'Chemistry',
    rating: '4.7',
    reviews: '84 reviews',
    price: '140,000₫',
    mobilePrice: '140k',
    image: '/assets/figma/student-tutor-1.jpg',
  },
];

export const studentBookings = [
  { day: '18', month: 'NOV', title: 'Mathematics with Minh Anh', time: '10:30 – 11:30', format: 'Online', status: 'Confirmed', action: 'Join lesson' },
  { day: '22', month: 'NOV', title: 'English with Thu Ha', time: '19:00 – 20:00', format: 'Online', status: 'Pending', action: 'View details' },
  { day: '27', month: 'NOV', title: 'Physics with Minh Anh', time: '15:30 – 16:30', format: 'In person', status: 'Pending', action: 'View details' },
  { day: '03', month: 'DEC', title: 'Chemistry with Quang Huy', time: '09:00 – 10:00', format: 'Online', status: 'Pending', action: 'View details' },
];

export const studentNotifications = [
  ['Booking confirmed', 'Your lesson with Minh Anh is set for 18 Nov at 10:30.', '5 min ago', 2],
  ['Lesson starts in 30 minutes', 'Open the lesson room when you’re ready.', '5 min ago', 3],
  ['Tutor updated availability', 'New evening time slots are now available.', 'Yesterday', 1],
  ['Booking cancelled', 'Your Tuesday lesson was cancelled by the tutor.', 'Yesterday', 2],
  ['Complete your learning profile', 'Add subjects and goals for better recommendations.', 'Yesterday', 3],
] as const;
