export const demoCourses = [
  ['portrait-photography','Portrait Photography Masterclass','Jane Copper','One by One','dashboard-course-camera.png','Camera settings, natural light and portrait composition.'],
  ['interface-design','User Interface Design Masterclass','Jane Copper','Workshop','dashboard-course-ui.png','Build a consistent interface with typography, spacing and reusable components.'],
  ['ux-research','UX Research Class','Tran Thu Ha','Personal Coaching','dashboard-research.png','Plan interviews, synthesise findings and validate a product hypothesis.'],
  ['app-development','App Development Course','Le Quang Huy','Workshop','dashboard-app.png','Build an application through practical weekly assignments.'],
  ['figma-workshop','Figma UI/UX Workshop','Nguyen Minh Anh','Workshop','dashboard-figma.png','Auto layout, components and interactive prototypes.'],
  ['design-webinar','Webinar','Pham Ngoc Linh','Webinar','dashboard-course-ui.png','Live discussion of accessible and responsive product design.'],
  ['typography','Typography in UX/UI','Tran Thu Ha','Webinar','dashboard-research.png','Type hierarchy, readable layouts and font pairing.'],
  ['css-designers','CSS for Designers','Le Quang Huy','Workshop','dashboard-app.png','Translate design decisions into responsive browser layouts.'],
  ['design-foundations','3D Design Foundations','Pham Ngoc Linh','Workshop','dashboard-figma.png','Explore form, lighting and material through guided exercises.'],
  ['composition','Design Composition','Jane Copper','Personal Coaching','dashboard-course-camera.png','Balance, rhythm and visual hierarchy for clear communication.'],
  ['color','Color Psychology','Nguyen Minh Anh','Webinar','dashboard-figma.png','Create accessible palettes and communicate with colour.'],
  ['portfolio','Portfolio Review','Tran Thu Ha','One by One','dashboard-course-ui.png','A personalised review with a concrete improvement plan.'],
].map(([id,title,instructor,category,image,description],index)=>({id,title,instructor,category,image:`/assets/figma/${image}`,description,date:`2026-11-${String(16+index).padStart(2,'0')}`,time:index%2?'14:00 – 15:00':'09:00 – 10:00',capacity:category==='One by One'?1:20,enrolled:category==='One by One'?1:8+index%10}));
