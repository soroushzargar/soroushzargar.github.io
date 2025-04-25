// Smooth scrolling for navigation links
document.addEventListener('DOMContentLoaded', function() {
    const navLinks = document.querySelectorAll('.nav-links a');
    
    for (const link of navLinks) {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            const targetId = this.getAttribute('href');
            const targetElement = document.querySelector(targetId);
            
            if (targetElement) {
                // Smooth scroll to the element
                window.scrollTo({
                    top: targetElement.offsetTop - 70,
                    behavior: 'smooth'
                });
            }
        });
    }
    
    // Highlight active section in navigation
    window.addEventListener('scroll', function() {
        const sections = document.querySelectorAll('section');
        const navLinks = document.querySelectorAll('.nav-links a');
        
        let currentSection = '';
        
        sections.forEach(section => {
            const sectionTop = section.offsetTop - 100;
            const sectionHeight = section.offsetHeight;
            
            if (window.pageYOffset >= sectionTop && window.pageYOffset < sectionTop + sectionHeight) {
                currentSection = '#' + section.getAttribute('id');
            }
        });
        
        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === currentSection) {
                link.classList.add('active');
            }
        });
    });
    
    // Toggle publication details
    const publications = document.querySelectorAll('.publication');
    publications.forEach(pub => {
        const heading = pub.querySelector('h3');
        const contentDiv = pub.querySelector('.pub-content');
        const toggleBtn = pub.querySelector('.toggle-btn');
        
        if (heading && toggleBtn && contentDiv) {
            toggleBtn.addEventListener('click', function(e) {
                e.stopPropagation(); // Prevent heading click from firing
                contentDiv.classList.toggle('show');
                if (contentDiv.classList.contains('show')) {
                    toggleBtn.textContent = 'Hide details';
                } else {
                    toggleBtn.textContent = 'Show details';
                }
            });
            
            heading.addEventListener('click', function() {
                if (contentDiv) {
                    contentDiv.classList.toggle('show');
                    if (contentDiv.classList.contains('show')) {
                        toggleBtn.textContent = 'Hide details';
                    } else {
                        toggleBtn.textContent = 'Show details';
                    }
                }
            });
        }
    });
});