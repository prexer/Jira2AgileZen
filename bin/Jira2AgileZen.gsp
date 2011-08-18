#!/usr/bin/env gosu
classpath "../src/,../lib/"

uses gw.GuidewireJiraSoapServiceServiceLocator
uses gw.RemoteFilter
uses xsds.agilezenstories.Story
uses az.jiralogon
uses java.util.Date
uses gw.RemoteIssue
uses java.util.Map
uses az.AZUtil

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

// some useful debug code to help find fields in Jira.  You usually want this commented out
//jiraissues.values.each( \ j ->   { 
//  print ("Jira # ${j.Key}")
//  print ("    CustomFields:  ID | Key | Value")
//  j.CustomFieldValues.each( \ cfv -> {
//        print ("||${cfv.CustomfieldId}|${cfv.Key}| ${cfv.Values.first()}   ")
//  } ) 
//} )


// If there is a Jira already in AZ, update it
// if there is a Jira not in AZ, then push it
jiraissues.values.each(\ j ->    { 
  // if (j.Type.equals("6") ) print ("Jira: ${j.Key}, Type: ${j.Type}")
  if (azStories.containsKey( j.Key )){ 
    myAZUtil.updateAZStory2(j, azStories.get( j.Key ))
  }  else {
    myAZUtil.pushNewStoryToAZ( j)
  }
})

// If there is a story in AZ with a Jira link that isn't in Jira, remove it from AZ
// Note that this is fairly rare, usually only happens for doc clones
// but caused some problems, so the delete method now only logs.
azStories.entrySet().each( \ entry -> {
   var key  = entry.Key
   var story = entry.Value
   if (jiraissues.containsKey( key )){
      
   } else {
     print ("Deleting ${key} from AgileZen")
     myAZUtil.deleteAZStory( story )
   }
  } )  
  
myAZUtil.tagReleases(jiraissues, azStories){
   
}
  
  
var date = new Date()
print ("${date} Added ${myAZUtil.NewCount}, Updated ${myAZUtil.UpdateCount}, Deleted ${myAZUtil.DeleteCount}")
