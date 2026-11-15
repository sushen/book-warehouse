// Fictional demonstration inventory. One record represents one physical copy.
window.BookWarehouseSample = Object.freeze({
  locations: [
    { id: 'harbor', name: 'Harbor Reading Room', nameBn: 'হারবার পাঠকক্ষ', area: 'Fictional North Quay' },
    { id: 'orchard', name: 'Orchard Library Corner', nameBn: 'অরচার্ড পাঠাগার কোণ', area: 'Fictional Garden District' }
  ],
  books: [
    { id: 'b01', title: 'The Map of Quiet Streets', titleBn: 'নীরব রাস্তার মানচিত্র', author: 'Mira Sen', authorBn: 'মীরা সেন', language: 'English', category: 'Fiction', topics: 'city memory belonging', topicsBn: 'কল্পকাহিনি শহর স্মৃতি আপনজন', locationId: 'harbor' },
    { id: 'b02', title: 'River Letters', titleBn: 'নদীর চিঠি', author: 'Nila Rahman', authorBn: 'নীলা রহমান', language: 'Bengali', category: 'Fiction', topics: 'river family letters', topicsBn: 'কল্পকাহিনি নদী পরিবার চিঠি', locationId: 'orchard' },
    { id: 'b03', title: 'A Small Atlas of Stars', titleBn: 'তারার ছোট মানচিত্র', author: 'Tarin Das', authorBn: 'তারিন দাস', language: 'English', category: 'Science', topics: 'astronomy night sky', topicsBn: 'বিজ্ঞান জ্যোতির্বিজ্ঞান রাত আকাশ', locationId: 'harbor' },
    { id: 'b04', title: 'Gardens After Rain', titleBn: 'বৃষ্টির পরের বাগান', author: 'Laila Noor', authorBn: 'লায়লা নূর', language: 'Bengali', category: 'Nature', topics: 'gardening plants climate', topicsBn: 'প্রকৃতি বাগান গাছ জলবায়ু', locationId: 'orchard' },
    { id: 'b05', title: 'The Listening City', titleBn: 'শোনে যে শহর', author: 'Arun Malik', authorBn: 'অরুণ মালিক', language: 'English', category: 'Architecture', topics: 'urban design sound', topicsBn: 'স্থাপত্য শহর নকশা শব্দ', locationId: 'harbor' },
    { id: 'b06', title: 'Stories for the Monsoon', titleBn: 'বর্ষার গল্প', author: 'Safa Karim', authorBn: 'সাফা করিম', language: 'Bengali', category: 'Stories', topics: 'weather folklore children', topicsBn: 'গল্প আবহাওয়া লোককথা শিশু', locationId: 'orchard' },
    { id: 'b07', title: 'A History of Everyday Things', titleBn: 'নিত্যদিনের জিনিসের ইতিহাস', author: 'Ira Bose', authorBn: 'ইরা বসু', language: 'English', category: 'History', topics: 'objects culture everyday life', topicsBn: 'ইতিহাস জিনিস সংস্কৃতি দৈনন্দিন জীবন', locationId: 'harbor' },
    { id: 'b08', title: 'Threads of the Delta', titleBn: 'বদ্বীপের সুতো', author: 'Rehan Ali', authorBn: 'রেহান আলী', language: 'Bengali', category: 'Art', topics: 'textiles craft heritage', topicsBn: 'শিল্প বস্ত্র কারুশিল্প ঐতিহ্য', locationId: 'orchard' },
    { id: 'b09', title: 'The Open Workshop', titleBn: 'সবার জন্য কর্মশালা', author: 'Elena Shah', authorBn: 'এলেনা শাহ', language: 'English', category: 'Making', topics: 'design repair community', topicsBn: 'হাতেকলমে কাজ নকশা মেরামত সম্প্রদায়', locationId: 'harbor' },
    { id: 'b10', title: 'Questions About Water', titleBn: 'পানি নিয়ে প্রশ্ন', author: 'Mahir Chowdhury', authorBn: 'মাহির চৌধুরী', language: 'English', category: 'Science', topics: 'water ecology rivers', topicsBn: 'বিজ্ঞান পানি বাস্তুতন্ত্র নদী', locationId: 'orchard' },
    { id: 'b11', title: 'Poems from the Courtyard', titleBn: 'উঠোনের কবিতা', author: 'Farah Moin', authorBn: 'ফারাহ মঈন', language: 'Bengali', category: 'Poetry', topics: 'home seasons poetry', topicsBn: 'বাড়ি ঋতু কবিতা', locationId: 'harbor' },
    { id: 'b12', title: 'The Patient Bicycle', titleBn: 'ধৈর্যশীল সাইকেল', author: 'Jules Roy', authorBn: 'জুল রায়', language: 'English', category: 'Fiction', topics: 'travel friendship cycling', topicsBn: 'কল্পকাহিনি ভ্রমণ বন্ধুত্ব সাইকেল', locationId: 'orchard' }
  ]
});
