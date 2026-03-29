// Show selected file name next to the upload button
const fileInput = document.getElementById('fileInput');
const fileNameDisplay = document.getElementById('fileNameDisplay');

fileInput.addEventListener('change', function() {
  if (fileInput.files && fileInput.files.length > 0) {
    fileNameDisplay.textContent = fileInput.files[0].name;
  } else {
    fileNameDisplay.textContent = '';
  }
});

const form = document.getElementById('uploadForm');

function showValidationError(message) {
  alert(message);
}

form.onsubmit = async (e) => {
  e.preventDefault();

  const fileInput = document.getElementById('fileInput');
  const type = document.querySelector('input[name="clothingType"]:checked');
  const majorColors = document.querySelectorAll('input[name="clothingColor"]');
  const minorColors = document.querySelectorAll('input[name="clothingMinorColor"]');
  const seasons = document.querySelectorAll('input[name="season"]');
  const fit = document.querySelector('input[name="fit"]:checked');
  const submitButton = form.querySelector('button[type="submit"]');
  const originalButtonText = submitButton.textContent;

  // Validation checks
  if (!fileInput.files || fileInput.files.length === 0) {
    showValidationError('Please select a file to upload.');
    return;
  }
  if (!type) {
    showValidationError('Please select a clothing type.');
    return;
  }
  if (!Array.from(majorColors).some(cb => cb.checked)) {
    showValidationError('Please select at least one major color.');
    return;
  }
  if (!Array.from(seasons).some(cb => cb.checked)) {
    showValidationError('Please select at least one season.');
    return;
  }
  if (!fit) {
    showValidationError('Please select a fit.');
    return;
  }

  // Show loading indication
  submitButton.disabled = true;
  submitButton.textContent = 'Processing...';

  // Prepare form data
  const formData = new FormData();
  formData.append('file', fileInput.files[0]);
  formData.append('type', type.value);
  Array.from(majorColors)
    .filter(cb => cb.checked)
    .forEach(cb => formData.append('majorColors', cb.value));

  Array.from(minorColors)
    .filter(cb => cb.checked)
    .forEach(cb => formData.append('minorColors', cb.value));

  Array.from(seasons)
    .filter(cb => cb.checked)
    .forEach(cb => formData.append('season', cb.value));
  formData.append('fit', fit.value);

  try {
    const response = await fetch('http://192.168.0.111:8000/upload', {
      method: 'POST',
      body: formData
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Upload failed:', response.status, errorText);
      alert('Upload failed: ' + response.status);
    } else {
      console.log('Upload successful!');
      alert('Upload successful!');
    }
  } catch (err) {
    console.error('Error during upload:', err);
    alert('Error during upload: ' + err);
  } finally {
    // Restore button state
    submitButton.disabled = false;
    submitButton.textContent = originalButtonText;
  }
};