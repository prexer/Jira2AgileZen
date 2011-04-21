This Gosu program is meant to be setup on a crontab to keep an AgileZen board up to date with your Jiras.  As is, it will push Jiras that fall into a Jira filter to an AgileZen storyboard.  You will probably need to modify it to work with specific Jira customized fields.  But it should provide a decent starting point.  

To run:
  > gosu ./bin/Jira2AgileZen.gsp
  
To Setup:

Setup the properties files in src/az

AgileZen.properties
  Your agilezen project # (as shown in the url when you are looking at your project)
  Your agilezen key

JiraToAgileZenPhases.properties and AgileZenPhaseToJiraStatus.properties
  These 2 files provide mapping back and forth for Jira and AgileZen.  
  In order to set these up, you will need to do a bit of spelunking in both your Jira project, and your AgileZen Developer Console.  
  
  In AZ, a good way to get the ID's of your phases is to make sure you have a story in each phase, then hit their Developer Console, with an address like /api/v1/projects/12345/stories.  You'll need to substitute your AZ project ID for the 12345.  But that should give you a JSON response with each story, and it's phase.  
  In Jira, the easiest way to figure out your status id's is to create a filter, and then look at the URL as you hover over that filter URL.  Yeah, lame.  There'e probably a better way, but it worked for me. 
  
jiralogin.properties
  Setup your username, password, and jira filter #.  Again, you get to go spelunking to figure out your filter ID #.  That theme will prevail.
  
jirapriority.properties
  These should be pretty standard, unless you've modified your priorities in Jira. 
  
