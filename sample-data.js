// Fictional demonstration inventory. One record represents one physical copy.
window.BookWarehouseSample = Object.freeze({
  locations: [
    { id: 'harbor', name: 'Harbor Reading Room', area: 'Fictional North Quay' },
    { id: 'orchard', name: 'Orchard Library Corner', area: 'Fictional Garden District' }
  ],
  books: [
    { id: 'b01', title: 'The Map of Quiet Streets', author: 'Mira Sen', language: 'English', category: 'Fiction', topics: 'city memory belonging', locationId: 'harbor' },
    { id: 'b02', title: 'River Letters', author: 'Nila Rahman', language: 'Bengali', category: 'Fiction', topics: 'river family letters', locationId: 'orchard' },
    { id: 'b03', title: 'A Small Atlas of Stars', author: 'Tarin Das', language: 'English', category: 'Science', topics: 'astronomy night sky', locationId: 'harbor' },
    { id: 'b04', title: 'Gardens After Rain', author: 'Laila Noor', language: 'Bengali', category: 'Nature', topics: 'gardening plants climate', locationId: 'orchard' },
    { id: 'b05', title: 'The Listening City', author: 'Arun Malik', language: 'English', category: 'Architecture', topics: 'urban design sound', locationId: 'harbor' },
    { id: 'b06', title: 'Stories for the Monsoon', author: 'Safa Karim', language: 'Bengali', category: 'Stories', topics: 'weather folklore children', locationId: 'orchard' },
    { id: 'b07', title: 'A History of Everyday Things', author: 'Ira Bose', language: 'English', category: 'History', topics: 'objects culture everyday life', locationId: 'harbor' },
    { id: 'b08', title: 'Threads of the Delta', author: 'Rehan Ali', language: 'Bengali', category: 'Art', topics: 'textiles craft heritage', locationId: 'orchard' },
    { id: 'b09', title: 'The Open Workshop', author: 'Elena Shah', language: 'English', category: 'Making', topics: 'design repair community', locationId: 'harbor' },
    { id: 'b10', title: 'Questions About Water', author: 'Mahir Chowdhury', language: 'English', category: 'Science', topics: 'water ecology rivers', locationId: 'orchard' },
    { id: 'b11', title: 'Poems from the Courtyard', author: 'Farah Moin', language: 'Bengali', category: 'Poetry', topics: 'home seasons poetry', locationId: 'harbor' },
    { id: 'b12', title: 'The Patient Bicycle', author: 'Jules Roy', language: 'English', category: 'Fiction', topics: 'travel friendship cycling', locationId: 'orchard' }
  ]
});
