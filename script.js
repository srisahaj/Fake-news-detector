document.getElementById("claimForm").addEventListener("submit", async function(e) {
  e.preventDefault();
  
  const formData = new FormData(this);
  const claim = formData.get("claim");
  
  if (!claim.trim()) {
    alert("Please enter a claim to verify!");
    return;
  }

  // Show loading state
  const submitButton = this.querySelector('button[type="submit"]');
  const buttonText = submitButton.querySelector('.button-text');
  const buttonLoader = submitButton.querySelector('.button-loader');
  
  submitButton.disabled = true;
  buttonText.style.display = 'none';
  buttonLoader.style.display = 'inline';
  
  // Hide results while loading
  document.getElementById("results-container").style.display = 'none';

  try {
    const response = await fetch("/", {
      method: "POST",
      body: formData
    });

    const data = await response.json();

    if (data.error) {
      alert(data.error);
      return;
    }

    // Display results
    displayResults(data);
    
    // Show results container
    document.getElementById("results-container").style.display = 'block';
    
    // Scroll to results
    document.getElementById("results-container").scrollIntoView({ 
      behavior: 'smooth',
      block: 'start'
    });

  } catch (error) {
    alert("An error occurred while verifying the claim. Please try again.");
    console.error(error);
  } finally {
    // Reset button state
    submitButton.disabled = false;
    buttonText.style.display = 'inline';
    buttonLoader.style.display = 'none';
  }
});

function displayResults(data) {
  const { score, analysis, color, sources } = data;
  
  // Determine confidence level
  let confidenceLevel, confidenceClass;
  if (score >= 70) {
    confidenceLevel = "HIGH CONFIDENCE";
    confidenceClass = "color-green";
  } else if (score >= 40) {
    confidenceLevel = "MEDIUM CONFIDENCE";
    confidenceClass = "color-orange";
  } else {
    confidenceLevel = "LOW CONFIDENCE";
    confidenceClass = "color-red";
  }
  
  // Update score display
  const scoreNumber = document.getElementById("score-number");
  scoreNumber.textContent = score;
  scoreNumber.className = `score-number ${confidenceClass}`;
  
  const scorePercent = document.querySelector(".score-percent");
  scorePercent.className = `score-percent ${confidenceClass}`;
  
  // Update confidence label
  const confidenceLabel = document.getElementById("confidence-label");
  confidenceLabel.textContent = confidenceLevel;
  confidenceLabel.className = `confidence-subtitle ${confidenceClass}`;
  
  // Update arc visualization
  updateArc(score, confidenceClass);
  
  // Update summary content
  const summaryContent = document.getElementById("summary-content");
  const summaryText = extractSummary(analysis);
  summaryContent.innerHTML = `<p class="summary-text">${summaryText}</p>`;
  
  // Update analysis content
  const analysisContent = document.getElementById("analysis-content");
  analysisContent.innerHTML = analysis;
  
  // Update stats
  document.getElementById("stat-score").textContent = `${score}/100`;
  document.getElementById("stat-score").className = `stat-value highlight ${confidenceClass}`;
  document.getElementById("stat-confidence").textContent = confidenceLevel.split(' ')[0];
  document.getElementById("stat-sources").textContent = sources ? sources.length : 0;
  
  // Update sources
  if (sources && sources.length > 0) {
    displaySources(sources);
  } else {
    document.getElementById("sources-section").style.display = 'none';
  }
}

function extractSummary(analysis) {
  // Try to extract the first paragraph or meaningful content
  const div = document.createElement('div');
  div.innerHTML = analysis;
  
  // Get text content and clean it
  let text = div.textContent || div.innerText || '';
  
  // Remove "VERDICT:", "ANALYSIS:" labels if present
  text = text.replace(/VERDICT:\s*/i, '').replace(/ANALYSIS:\s*/i, '');
  
  // Get first substantial paragraph (at least 100 characters)
  const paragraphs = text.split('\n').filter(p => p.trim().length > 100);
  
  return paragraphs[0] || text.substring(0, 500) + '...';
}

function updateArc(score, colorClass) {
  const arc = document.getElementById("score-arc");
  
  // Calculate arc path based on score (0-100 -> 0-180 degrees)
  const angle = (score / 100) * 180;
  const radians = (angle * Math.PI) / 180;
  
  const centerX = 60;
  const centerY = 50;
  const radius = 50;
  
  const endX = centerX - radius * Math.cos(radians);
  const endY = centerY - radius * Math.sin(radians);
  
  const largeArcFlag = angle > 180 ? 1 : 0;
  
  const pathData = `M 10 50 A 50 50 0 ${largeArcFlag} 1 ${endX} ${endY}`;
  arc.setAttribute('d', pathData);
  
  // Update stroke color
  const strokeClass = colorClass.replace('color-', 'stroke-');
  arc.className.baseVal = strokeClass;
}

function displaySources(sources) {
  const sourcesSection = document.getElementById("sources-section");
  const sourcesGrid = document.getElementById("sources-grid");
  const sourceCount = document.getElementById("source-count");
  
  sourcesSection.style.display = 'block';
  sourceCount.textContent = `${sources.length} SOURCE${sources.length !== 1 ? 'S' : ''}`;
  
  sourcesGrid.innerHTML = '';
  
  sources.forEach((source, index) => {
    const sourceItem = document.createElement('div');
    sourceItem.className = 'source-item';
    
    // Extract domain from URI
    let domain = '';
    try {
      const url = new URL(source.uri);
      domain = url.hostname.replace('www.', '');
    } catch (e) {
      domain = 'External Source';
    }
    
    sourceItem.innerHTML = `
      <span class="source-number">${index + 1}</span>
      <a href="${source.uri}" target="_blank" class="source-link">
        ${source.title || source.uri}
        <span class="domain">${domain}</span>
      </a>
    `;
    
    sourcesGrid.appendChild(sourceItem);
  });
}