#!/usr/bin/env gosu
classpath "../src/,../lib/*.jar"


uses gw.GuidewireJiraSoapServiceServiceLocator
uses gw.RemoteFilter
uses xsds.agilezenstories.Story
uses java.util.HashMap
uses az.AZUtil
uses az.jiralogon
uses org.apache.log4j.Logger
uses java.util.GregorianCalendar
uses java.util.Date

var myAZUtil = new AZUtil()
myAZUtil.Project = az.AgileZen.AZProjectID
myAZUtil.ApiKey = az.AgileZen.AZApiKey
var jirauser = jiralogon.jirauser
var jirapass = jiralogon.jirapasswd
var jirafilter = jiralogon.jirafilter

var jiraservice = new GuidewireJiraSoapServiceServiceLocator().getgwjirasoapservice();
var jiratoken = jiraservice.login(jirauser, jirapass)
var filters = jiraservice.getSavedFilters(jiratoken)

var kanbanfilter = filters.firstWhere( \ r -> r.Id.equals( jirafilter ) )
if ( kanbanFilter != null ) {
  var in1 = new RemoteFilter(kanbanFilter.Id, null, null, null, null, null);
}
var jiraissues = jiraservice.getIssuesForFilter( jiratoken, kanbanfilter ).partitionUniquely( \ r ->r.Key  )

print ("Jira Pull size: " + jiraissues.Count)
var azStories = myAZUtil.getAZStories()

if (jiraissues.Count == 0) throw ("No Jira issues found in your filter, or Jira not available")

jiraissues.values.each(\ j ->    { 
  //if (j.Type.equals("6") ) print ("Jira: ${j.Key}, Type: ${j.Type}")
  if (azStories.containsKey( j.Key )){ 
    myAZUtil.updateAZStory(j, azStories.get( j.Key ))
  }  else {
    myAZUtil.pushNewStoryToAZ( j)
  }
})

azStories.entrySet().each( \ entry -> {
   var key  = entry.Key
   var story = entry.Value
   if (jiraissues.containsKey( key )){
      
   } else {
     print ("Deleting ${key} from AgileZen")
     myAZUtil.deleteAZStory( story )
   }
  } )  
var date = new Date()
print ("${date} Added ${myAZUtil.NewCount}, Updated ${myAZUtil.UpdateCount}, Deleted ${myAZUtil.DeleteCount}")
