// Capitalize the first letter of a string
function capitalize(str) {
    if (typeof str !== 'string' || !str.length) return str;
    return str.charAt(0).toUpperCase() + str.slice(1);
}

async function loadClothingImages() {
    try {
        const clothes = await fetch('http://localhost:8000/clothing')
            .then(res => res.json());
        clothes.forEach(item => {
            const card = document.createElement('div');
            card.className = 'clothing-card';

            const img = document.createElement('img');
            img.src = 'http://localhost:8000/images/' + item.image_path;
            img.alt = item.type || 'Clothing item';
            img.style.maxWidth = '200px';

            const info = document.createElement('p');
            info.className = 'clothing-info';
            info.innerHTML = `
                <strong>Type:</strong> ${item.type || 'None'}<br>
                <strong>Colors:</strong> ${Array.isArray(item.color) ? item.color.map(capitalize).join(', ') : (item.color ? capitalize(item.color) : 'None')}<br>
                <strong>Minor Colors:</strong> ${Array.isArray(item.minor_color) ? item.minor_color.map(capitalize).join(', ') : (item.minor_color ? capitalize(item.minor_color) : 'None')}<br>
                <strong>Season:</strong> ${Array.isArray(item.season) ? item.season.join(', ') : item.season || 'None'}<br>
                <strong>Fit:</strong> ${item.fit || 'None'}
            `;

            card.appendChild(img);
            card.appendChild(info);
            document.getElementById('clothing-gallery').appendChild(card);
        });
    } catch (error) {
        console.error('Error fetching clothing:', error);
        alert('Error fetching clothing: ' + error);
    }
}

window.addEventListener('DOMContentLoaded', loadClothingImages);