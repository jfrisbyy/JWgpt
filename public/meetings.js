meetings=function(){window.renderCalendarMeeting?.('overview')};
const originalWorkspace=workspace;
workspace=function(s){if(['midweek','watchtower'].includes(s.type)){s.title=s.type==='midweek'?'Midweek meeting':'Watchtower study';window.renderCalendarMeeting?.(s.type)}else originalWorkspace(s)};
