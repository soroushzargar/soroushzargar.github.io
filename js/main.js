document.addEventListener('DOMContentLoaded', function() {
    setupSmoothScrolling();
    setupActiveNavHighlighting();
    setupPublicationToggles();
});

// Setup smooth scrolling for in-page navigation
function setupSmoothScrolling() {
    const navLinks = document.querySelectorAll('.nav-links a');
    
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            
            // Only apply to same-page links
            if (href && href.startsWith('#')) {
                e.preventDefault();
                const targetSection = document.querySelector(href);
                
                if (targetSection) {
                    window.scrollTo({
                        top: targetSection.offsetTop - 70,
                        behavior: 'smooth'
                    });
                }
            }
        });
    });
}

// Highlight active section in navigation
function setupActiveNavHighlighting() {
    window.addEventListener('scroll', function() {
        const sections = document.querySelectorAll('section[id]');
        const navLinks = document.querySelectorAll('.nav-links a');
        
        let currentSection = '';
        
        sections.forEach(section => {
            const sectionTop = section.offsetTop - 100;
            const sectionHeight = section.offsetHeight;
            
            if (window.scrollY >= sectionTop && window.scrollY < sectionTop + sectionHeight) {
                currentSection = '#' + section.getAttribute('id');
            }
        });
        
        navLinks.forEach(link => {
            link.classList.remove('active');
            const href = link.getAttribute('href');
            if (href && href.endsWith(currentSection)) {
                link.classList.add('active');
            }
        });
    });
}

// Setup publication toggle buttons
function setupPublicationToggles() {
    const publications = document.querySelectorAll('.publication');
    
    publications.forEach(publication => {
        const heading = publication.querySelector('h3');
        const toggleBtn = publication.querySelector('.toggle-btn');
        const content = publication.querySelector('.pub-content');
        
        // Skip if any required element is missing
        if (!heading || !toggleBtn || !content) return;
        
        // Skip if button is disabled
        if (toggleBtn.disabled) return;
        
        function toggleContent(event) {
            // Don't proceed if the clicked element is a link or if button is disabled
            if (event && event.target.tagName.toLowerCase() === 'a') return;
            if (toggleBtn.disabled) return;
            
            // Toggle visibility
            if (content.classList.contains('show')) {
                content.classList.remove('show');
                toggleBtn.textContent = 'Show details';
            } else {
                content.classList.add('show');
                toggleBtn.textContent = 'Hide details';
            }
        }
        
        // Add click event to toggle button
        toggleBtn.addEventListener('click', function(e) {
            e.stopPropagation(); // Prevent event bubbling to heading
            toggleContent();
        });
        
        // Add click event to heading
        heading.addEventListener('click', toggleContent);
    });
}