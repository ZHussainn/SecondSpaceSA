// Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyAW-mK3pwGTdu0bH-efGOWgwaB1QyHmGQ0",
  authDomain: "secondspacesa-34f63.firebaseapp.com",
  projectId: "secondspacesa-34f63",
  storageBucket: "secondspacesa-34f63.appspot.com",
  messagingSenderId: "538399802125",
  appId: "1:538399802125:web:998cf98ffd8fdb95c82644",
  measurementId: "G-5FZ5R8NVFX"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Cloudinary Config
const CLOUD_NAME = "dn0nnycgf";   
const UPLOAD_PRESET = "unsigned_preset"; 

// UI elements
const authStatus = document.getElementById("auth-status");
const productSection = document.getElementById("product-section");
const cartSection = document.getElementById("cart-section");
const ordersSection = document.getElementById("orders-section");

let currentUserRole = null;
let cart = []; 

// ----------------- AUTH FUNCTIONS -----------------

function signup() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const role = prompt("Enter role (buyer / seller ):").toLowerCase();

  if (!["buyer", "seller"].includes(role)) {
    alert("⚠️ Invalid role. Use buyer, seller");
    return;
  }

  auth.createUserWithEmailAndPassword(email, password)
    .then(cred => {
      return db.collection("users").doc(cred.user.uid).set({
        email,
        role
      });
    })
    .then(() => {
      if (authStatus) authStatus.innerText = `✅ Signup successful as ${role}`;
    })
    .catch(err => {
      if (authStatus) authStatus.innerText = "❌ " + err.message;
    });
}

function login() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  auth.signInWithEmailAndPassword(email, password)
    .then(() => {
      if (authStatus) authStatus.innerText = "✅ Logged in";
    })
    .catch(err => {
      if (authStatus) authStatus.innerText = "❌ " + err.message;
    });
}

function logout() {
  auth.signOut().then(() => {
    if (authStatus) authStatus.innerText = "👋 Logged out";
    if (productSection) productSection.style.display = "none";
    if (cartSection) cartSection.style.display = "none";
    if (ordersSection) ordersSection.style.display = "none";
    currentUserRole = null;
    cart = [];
  });
}

// Load category-specific products
auth.onAuthStateChanged(async user => {
  if (user) {
    const doc = await db.collection("users").doc(user.uid).get();
    if (doc.exists) {
      currentUserRole = doc.data().role;
      if (authStatus) {
        authStatus.innerText = `🔑 Logged in as ${user.email} (Role: ${currentUserRole})`;
      }

      
      if (window.location.pathname.includes("womens.html")) {
        loadProducts("women");
      } else if (window.location.pathname.includes("mens.html")) {
        loadProducts("men");
      } else if (productSection) {
        
        loadProducts();
        productSection.style.display = "block";
      }

      // Buyer/admin UI
      if (currentUserRole === "buyer" && cartSection) {
        cartSection.style.display = "block";
      }
      if ((currentUserRole === "buyer") && ordersSection) {
        loadOrders();
        ordersSection.style.display = "block";
      }
    }
  } else {
    if (productSection) productSection.style.display = "none";
    if (cartSection) cartSection.style.display = "none";
    if (ordersSection) ordersSection.style.display = "none";
  }
});

// ----PRODUCT FUNCTIONS ----

async function addProduct() {
  if (currentUserRole !== "seller") {
    alert("⚠️ Only sellers can see products");
    return;
  }

  const name = document.getElementById("productName").value;
  const price = parseFloat(document.getElementById("productPrice").value);
  const category = document.getElementById("productCategory").value;
  const imageFile = document.getElementById("productImage").files[0];

  if (!name || !price || !category || !imageFile) {
    alert("⚠️ Please fill all fields and select an image");
    return;
  }

  const user = auth.currentUser;

  try {
    // Upload to Cloudinary
    const formData = new FormData();
    formData.append("file", imageFile);
    formData.append("upload_preset", UPLOAD_PRESET);

    const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
      method: "POST",
      body: formData
    });

    const data = await response.json();
    if (!data.secure_url) throw new Error("Image upload failed");

    const imageUrl = data.secure_url;

    // Save to Firestore
    await db.collection("products").add({
      name,
      price,
      category,
      imageUrl,
      sellerEmail: user.email
    });

    // Clear form
    document.getElementById("productName").value = "";
    document.getElementById("productPrice").value = "";
    document.getElementById("productCategory").value = "";
    document.getElementById("productImage").value = "";

    alert("✅ Product uploaded successfully!");

    
    if (window.location.pathname.includes("womens.html")) {
      loadProducts("women");
    } else if (window.location.pathname.includes("mens.html")) {
      loadProducts("men");
    } else {
      loadProducts();
    }

  } catch (err) {
    alert("❌ Error uploading product: " + err.message);
    console.error(err);
  }
}

async function loadProducts(categoryFilter = null) {
  const list = document.getElementById("productList");
  if (!list) return;
  list.innerHTML = "";

  let query = db.collection("products");
  if (categoryFilter) query = query.where("category", "==", categoryFilter);

  const snapshot = await query.get();
  if (snapshot.empty) {
    list.innerHTML = "<p>No products found in this category.</p>";
    return;
  }

  snapshot.forEach(doc => {
    const product = doc.data();

    let actions = "";

    
    if (
      currentUserRole === "admin" ||
      (currentUserRole === "seller" && product.sellerEmail === auth.currentUser.email)
    ) {
      actions += `<button class="btn" onclick="deleteProduct('${doc.id}')">❌ Delete</button>`;
    }

    
    if (currentUserRole === "buyer") {
      actions += `
        <button class="btn" onclick="addToCart('${doc.id}', '${product.name}', ${product.price}, '${product.imageUrl}')">🛒 Add to Cart</button>
        <button class="btn" onclick="addToWishlist('${doc.id}', '${product.name}', ${product.price}, '${product.imageUrl}')">♡ Wishlist</button>
      `;
    }

    
    list.innerHTML += `
      <li>
        <img src="${product.imageUrl}" alt="${product.name}">
        <h3>${product.name}</h3>
        <p>R${product.price}</p>
        <p style="font-size: 0.9em; color: #666;">${product.category}</p>
        <small>Seller: ${product.sellerEmail || "Unknown"}</small>
        <div class="product-actions">${actions}</div>
      </li>
    `;
  });
}

async function deleteProduct(id) {
  await db.collection("products").doc(id).delete();

  if (window.location.pathname.includes("womens.html")) {
    loadProducts("women");
  } else if (window.location.pathname.includes("mens.html")) {
    loadProducts("men");
  } else {
    loadProducts();
  }
}



  function searchProducts() {
    const query = document.getElementById("searchInput").value.toLowerCase();
    const productCards = document.querySelectorAll(".product-card");

    productCards.forEach(card => {
      const name = card.querySelector("h3").innerText.toLowerCase();
      if (name.includes(query)) {
        card.style.display = "block";   
      } else {
        card.style.display = "none";    
      }
    });
  }




